import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toPostDTO } from "@/lib/blog-service";

export const runtime = "nodejs";

/**
 * Public: a single published post (by slug) + up to 3 related posts
 * sharing a tag. Unpublished posts are invisible to visitors.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 80) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const post = await db.blogPost.findUnique({
    where: { slug },
    include: { author: true },
  });
  if (!post || post.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const dto = toPostDTO(post);
  const primaryTag = dto.tags[0];
  const related = primaryTag
    ? (await db.blogPost.findMany({
        where: { status: "PUBLISHED", slug: { not: dto.slug }, tags: { contains: primaryTag } },
        include: { author: true },
        orderBy: { publishedAt: "desc" },
        take: 3,
      })).map(toPostDTO).map(({ content: _c, ...s }) => s)
    : [];

  return NextResponse.json({ post: dto, related });
}
