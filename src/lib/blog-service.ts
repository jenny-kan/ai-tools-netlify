import { db } from "@/lib/db";
import { sanitizeText } from "@/lib/security";
import type { BlogPost, Blogger } from "@/generated/prisma/client";
import type { BlogPostDTO, BlogPostInput, BlogPostStatus, BloggerStatus } from "@/lib/types";

/**
 * Blog domain logic shared by public, author and admin routes:
 * slug generation, tag parsing, post quality gates, DTO mapping.
 */

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "post"
  );
}

/** Generate a unique slug, appending -2, -3… when taken. */
export async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 2;
  while (await db.blogPost.findUnique({ where: { slug: candidate } })) {
    candidate = `${root}-${n++}`;
    if (n > 50) return `${root}-${Date.now().toString(36)}`;
  }
  return candidate;
}

/** Parse + clamp a tag list: max 5 tags, 24 chars each, sanitized, deduped. */
export function parseTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const clean = sanitizeText(t).replace(/[#,]/g, "").slice(0, 24);
    if (clean.length >= 2 && seen.size < 5) seen.add(clean.toLowerCase());
  }
  return [...seen];
}

// ------------------------------------------------------------- quality gates

export const POST_LIMITS = {
  titleMin: 10,
  titleMax: 120,
  excerptMin: 20,
  excerptMax: 200,
  /** Minimum for SUBMISSION — the editorial quality bar. */
  contentMinSubmit: 400,
  contentMax: 50_000,
  tagsMax: 5,
} as const;

export interface PostValidation {
  ok: boolean
  field?: string
  error?: string
  warnings: string[]
}

/**
 * Validate post input. Drafts get loose limits (work in progress);
 * `forSubmit` enforces the full editorial quality gates.
 */
export function validatePostInput(input: Partial<BlogPostInput>, forSubmit: boolean): PostValidation {
  const warnings: string[] = [];
  const title = sanitizeText(typeof input.title === "string" ? input.title : "");
  const excerpt = sanitizeText(typeof input.excerpt === "string" ? input.excerpt : "");
  const content = typeof input.content === "string" ? input.content.replace(/\r\n/g, "\n").trim() : "";
  const tags = parseTags(input.tags);

  const titleMin = forSubmit ? POST_LIMITS.titleMin : 4;
  if (title.length < titleMin || title.length > POST_LIMITS.titleMax) {
    return { ok: false, field: "title", error: `Title must be ${titleMin}–${POST_LIMITS.titleMax} characters.`, warnings };
  }
  if (excerpt.length > POST_LIMITS.excerptMax) {
    return { ok: false, field: "excerpt", error: `Excerpt must be at most ${POST_LIMITS.excerptMax} characters.`, warnings };
  }
  if (forSubmit && (excerpt.length < POST_LIMITS.excerptMin)) {
    return { ok: false, field: "excerpt", error: `Excerpt must be ${POST_LIMITS.excerptMin}–${POST_LIMITS.excerptMax} characters.`, warnings };
  }
  if (content.length > POST_LIMITS.contentMax) {
    return { ok: false, field: "content", error: `Content is too long (max ${POST_LIMITS.contentMax.toLocaleString()} characters).`, warnings };
  }
  if (forSubmit && content.length < POST_LIMITS.contentMinSubmit) {
    return { ok: false, field: "content", error: `Posts need at least ${POST_LIMITS.contentMinSubmit} characters of content before review.`, warnings };
  }
  if (!forSubmit && title.length >= POST_LIMITS.titleMin && excerpt.length < POST_LIMITS.excerptMin) {
    warnings.push("Add a short excerpt (20–200 chars) before submitting for review.");
  }
  if (!forSubmit && content.length < POST_LIMITS.contentMinSubmit) {
    warnings.push(`Content is ${content.length}/${POST_LIMITS.contentMinSubmit} characters — the review gate needs more.`);
  }
  return { ok: true, warnings };
}

// ------------------------------------------------------------------ DTO maps

export function toPostDTO(post: BlogPost & { author: Blogger }): BlogPostDTO {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    tags: post.tags ? post.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    status: post.status as BlogPostStatus,
    reviewNote: post.reviewNote,
    author: { id: post.author.id, name: post.author.name, bio: post.author.bio },
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function isBloggerStatus(v: string): v is BloggerStatus {
  return ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].includes(v);
}
