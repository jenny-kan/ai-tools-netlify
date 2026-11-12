import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { POST_LIMITS } from "@/lib/blog-service";
import { forbiddenOrigin, getClientIp, isSameOrigin, logAudit, rateLimit, sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Admin editorial actions on a blog post:
 *  - publish  : SUBMITTED/DRAFT → PUBLISHED (sets publishedAt)
 *  - reject   : SUBMITTED → REJECTED with a feedback note for the author
 *  - unpublish: PUBLISHED → DRAFT (takes the post off the site)
 * Every action re-checks the quality gates, so nothing skips review.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const limited = rateLimit(`admin-blog-post:${ip}`, 60, 10 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });

  const { id } = await params;
  const raw: unknown = await req.json().catch(() => null);
  const action = typeof raw === "object" && raw !== null ? String((raw as Record<string, unknown>).action ?? "") : "";
  const note = sanitizeText(
    typeof raw === "object" && raw !== null ? String((raw as Record<string, unknown>).note ?? "") : ""
  ).slice(0, 1000);

  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (action === "publish") {
    if (post.status === "PUBLISHED") {
      return NextResponse.json({ error: "This post is already published." }, { status: 409 });
    }
    // Final quality gate — even admins can't publish an empty post.
    if (
      post.title.length < POST_LIMITS.titleMin ||
      post.excerpt.length < POST_LIMITS.excerptMin ||
      post.content.trim().length < POST_LIMITS.contentMinSubmit
    ) {
      return NextResponse.json(
        { error: "Quality gate: the post doesn't meet the minimum title/excerpt/content rules." },
        { status: 400 }
      );
    }
    await db.blogPost.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: post.publishedAt ?? new Date(), reviewNote: "" },
    });
    logAudit("blog.post.published", { actorType: "admin", actorId: post.authorId, details: post.title, ip });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    if (post.status !== "SUBMITTED") {
      return NextResponse.json({ error: "Only submitted posts can be sent back." }, { status: 409 });
    }
    await db.blogPost.update({
      where: { id },
      data: { status: "REJECTED", reviewNote: note || "Needs work — see the editorial guidelines." },
    });
    logAudit("blog.post.rejected", { actorType: "admin", actorId: post.authorId, details: post.title, ip });
    return NextResponse.json({ ok: true });
  }

  if (action === "unpublish") {
    if (post.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Only published posts can be unpublished." }, { status: 409 });
    }
    await db.blogPost.update({ where: { id }, data: { status: "DRAFT", publishedAt: null } });
    logAudit("blog.post.unpublished", { actorType: "admin", actorId: post.authorId, details: post.title, ip });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
