import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { serverError } from "@/lib/route-errors";
import { toPostDTO } from "@/lib/blog-service";
import type { BloggerApplicationDTO, BloggerStatus } from "@/lib/types";

export const runtime = "nodejs";

/** Admin: everything the Blog tab needs in one call — applications + all posts. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return unauthorized();

  try {
    const [bloggers, posts] = await Promise.all([
      db.blogger.findMany({ orderBy: [{ status: "asc" }, { appliedAt: "desc" }] }),
      db.blogPost.findMany({ include: { author: true }, orderBy: { updatedAt: "desc" } }),
    ]);

    const applications: BloggerApplicationDTO[] = bloggers.map((b) => ({
      id: b.id,
      name: b.name,
      email: b.email,
      bio: b.bio,
      status: b.status as BloggerStatus,
      applicationReason: b.applicationReason,
      writingSample: b.writingSample,
      reviewNote: b.reviewNote,
      appliedAt: b.appliedAt.toISOString(),
      decidedAt: b.decidedAt ? b.decidedAt.toISOString() : null,
    }));

    return NextResponse.json({
      applications,
      posts: posts.map(toPostDTO),
    });
  } catch (e) {
    return serverError("Loading the blog overview", e);
  }
}
