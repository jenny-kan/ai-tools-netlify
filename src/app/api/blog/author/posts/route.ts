import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bloggerUnauthorized, getSessionBlogger } from "@/lib/blogger-auth";
import { toPostDTO, uniqueSlug, validatePostInput } from "@/lib/blog-service";
import { forbiddenOrigin, isSameOrigin, sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

/** Blogger: list my own posts (all statuses). */
export async function GET() {
  const me = await getSessionBlogger();
  if (!me || me.status !== "APPROVED") return bloggerUnauthorized();

  const posts = await db.blogPost.findMany({
    where: { authorId: me.id },
    include: { author: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(posts.map(toPostDTO));
}

/** Blogger: create a new draft. */
export async function POST(req: NextRequest) {
  const me = await getSessionBlogger();
  if (!me || me.status !== "APPROVED") return bloggerUnauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const raw: unknown = await req.json().catch(() => null);
  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const input = raw as Record<string, unknown>;
  const check = validatePostInput(input, false); // loose draft gates
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const title = sanitizeText(String(input.title ?? ""));
  const post = await db.blogPost.create({
    data: {
      slug: await uniqueSlug(title),
      title,
      excerpt: sanitizeText(String(input.excerpt ?? "")),
      content: String(input.content ?? "").replace(/\r\n/g, "\n").trim(),
      tags: (Array.isArray(input.tags) ? input.tags : [])
        .filter((t): t is string => typeof t === "string")
        .map((t) => sanitizeText(t).slice(0, 24).toLowerCase())
        .filter((t) => t.length >= 2)
        .slice(0, 5)
        .join(","),
      status: "DRAFT",
      authorId: me.id,
    },
    include: { author: true },
  });

  return NextResponse.json(toPostDTO(post));
}
