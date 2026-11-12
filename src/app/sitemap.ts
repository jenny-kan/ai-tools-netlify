import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Sitemap — the app lives on a single `/` route with query-param views, so
 * the important indexable URLs are the home page, the main views, and every
 * published blog post / published tool detail page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/?view=blog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/?view=donate`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/?view=contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const posts = await db.blogPost.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 200,
    });
    for (const p of posts) {
      entries.push({
        url: `${siteUrl}/?post=${encodeURIComponent(p.slug)}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    const tools = await db.tool.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      take: 200,
    });
    for (const t of tools) {
      entries.push({
        url: `${siteUrl}/?tool=${encodeURIComponent(t.slug)}`,
        lastModified: t.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // database unavailable at build time — the static entries still ship
  }

  return entries;
}
