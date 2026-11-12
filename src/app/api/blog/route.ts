import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toPostDTO } from "@/lib/blog-service";
import { sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Public: list published blog posts. Optional ?q= (search) and ?tag= filters.
 * Content is omitted from list items to keep the payload small.
 */
export async function GET(req: NextRequest) {
  const q = sanitizeText(req.nextUrl.searchParams.get("q") ?? "").toLowerCase();
  const tag = sanitizeText(req.nextUrl.searchParams.get("tag") ?? "").toLowerCase();

  const posts = await db.blogPost.findMany({
    where: { status: "PUBLISHED" },
    include: { author: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  let list = posts.map(toPostDTO);
  if (tag) list = list.filter((p) => p.tags.some((t) => t.toLowerCase() === tag));
  if (q) {
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.author.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({
    posts: list.map(({ content: _content, ...summary }) => summary),
    total: list.length,
  });
}
