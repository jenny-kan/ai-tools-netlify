import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bloggerUnauthorized, getSessionBlogger } from "@/lib/blogger-auth";
import { POST_LIMITS, toPostDTO } from "@/lib/blog-service";
import { forbiddenOrigin, isSameOrigin, logAudit } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Blogger: submit a post for editorial review.
 * Enforces the automatic quality gates (title, excerpt, content length)
 * before the post enters the admin review queue.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionBlogger();
  if (!me || me.status !== "APPROVED") return bloggerUnauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const { id } = await params;

  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post || post.authorId !== me.id) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.status === "SUBMITTED") {
    return NextResponse.json({ error: "This post is already in review." }, { status: 409 });
  }
  if (post.status === "PUBLISHED") {
    return NextResponse.json({ error: "This post is already published." }, { status: 409 });
  }

  // ---- automatic quality gates
  const errors: string[] = [];
  if (post.title.length < POST_LIMITS.titleMin || post.title.length > POST_LIMITS.titleMax) {
    errors.push(`title ${POST_LIMITS.titleMin}–${POST_LIMITS.titleMax} chars`);
  }
  if (post.excerpt.length < POST_LIMITS.excerptMin || post.excerpt.length > POST_LIMITS.excerptMax) {
    errors.push(`excerpt ${POST_LIMITS.excerptMin}–${POST_LIMITS.excerptMax} chars`);
  }
  if (post.content.trim().length < POST_LIMITS.contentMinSubmit) {
    errors.push(`at least ${POST_LIMITS.contentMinSubmit} chars of content`);
  }
  if (errors.length > 0) {
    return NextResponse.json(
      { error: `Quality check failed — the post needs: ${errors.join(", ")}.` },
      { status: 400 }
    );
  }

  const updated = await db.blogPost.update({
    where: { id: post.id },
    data: { status: "SUBMITTED", reviewNote: "" },
    include: { author: true },
  });

  logAudit("blog.post.submitted", { actorType: "blogger", actorId: me.id, details: post.title });
  return NextResponse.json(toPostDTO(updated));
}
