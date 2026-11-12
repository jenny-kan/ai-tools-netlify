import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bloggerUnauthorized, getSessionBlogger } from "@/lib/blogger-auth";
import { toPostDTO, uniqueSlug, validatePostInput } from "@/lib/blog-service";
import { forbiddenOrigin, isSameOrigin, logAudit, sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

/** Blogger: update one of MY drafts / rejected posts (ownership enforced). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionBlogger();
  if (!me || me.status !== "APPROVED") return bloggerUnauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const { id } = await params;

  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post || post.authorId !== me.id) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.status === "SUBMITTED" || post.status === "PUBLISHED") {
    return NextResponse.json(
      { error: post.status === "PUBLISHED" ? "Published posts are locked — contact the editors." : "This post is in review and can't be edited. Withdraw it first." },
      { status: 409 }
    );
  }

  const raw: unknown = await req.json().catch(() => null);
  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const input = raw as Record<string, unknown>;
  const check = validatePostInput(input, false);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const title = sanitizeText(String(input.title ?? ""));
  const updated = await db.blogPost.update({
    where: { id: post.id },
    data: {
      // keep the slug stable unless the title changed meaningfully
      ...(title !== post.title ? { slug: await uniqueSlug(title) } : {}),
      title,
      excerpt: sanitizeText(String(input.excerpt ?? "")),
      content: String(input.content ?? "").replace(/\r\n/g, "\n").trim(),
      tags: (Array.isArray(input.tags) ? input.tags : [])
        .filter((t): t is string => typeof t === "string")
        .map((t) => sanitizeText(t).slice(0, 24).toLowerCase())
        .filter((t) => t.length >= 2)
        .slice(0, 5)
        .join(","),
      // editing a rejected post moves it back to draft for a fresh review
      status: "DRAFT",
      reviewNote: "",
    },
    include: { author: true },
  });

  return NextResponse.json(toPostDTO(updated));
}

/** Blogger: delete one of MY drafts or rejected posts. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionBlogger();
  if (!me || me.status !== "APPROVED") return bloggerUnauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const { id } = await params;

  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post || post.authorId !== me.id) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.status === "SUBMITTED" || post.status === "PUBLISHED") {
    return NextResponse.json(
      { error: "Only drafts and rejected posts can be deleted." },
      { status: 409 }
    );
  }

  await db.blogPost.delete({ where: { id: post.id } });
  logAudit("blog.post.deleted", { actorType: "blogger", actorId: me.id, details: post.title });
  return NextResponse.json({ ok: true });
}
