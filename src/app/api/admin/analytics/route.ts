import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import type { AnalyticsDashboardResponse, AnalyticsDailyPoint, AnalyticsTopEntry } from "@/lib/types";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Admin: traffic analytics (page views, referrers, top tools) + recent audit events. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return unauthorized();

  const since14d = new Date(Date.now() - 14 * DAY_MS);
  const since30d = new Date(Date.now() - 30 * DAY_MS);
  const todayStart = new Date(dayKey(new Date()) + "T00:00:00.000Z");

  const [views14d, totalViews, totalSessions, views30d, viewsToday, recentAudit] = await Promise.all([
    db.pageView.findMany({
      where: { createdAt: { gte: since14d } },
      select: { path: true, referrer: true, sessionId: true, toolSlug: true, createdAt: true },
    }),
    db.pageView.count(),
    db.pageView.groupBy({ by: ["sessionId"], _count: { sessionId: true } }).then((g) => g.length),
    db.pageView.count({ where: { createdAt: { gte: since30d } } }),
    db.pageView.count({ where: { createdAt: { gte: todayStart } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);

  // ---- daily series (last 14 days, zeros included)
  const dailyMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    dailyMap.set(dayKey(new Date(Date.now() - i * DAY_MS)), 0);
  }
  for (const v of views14d) {
    const key = dayKey(v.createdAt);
    if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
  }
  const daily: AnalyticsDailyPoint[] = [...dailyMap.entries()].map(([date, views]) => ({ date, views }));

  // ---- top lists
  const pageCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();
  for (const v of views14d) {
    pageCounts.set(v.path, (pageCounts.get(v.path) ?? 0) + 1);
    if (v.referrer) referrerCounts.set(v.referrer, (referrerCounts.get(v.referrer) ?? 0) + 1);
    if (v.toolSlug) toolCounts.set(v.toolSlug, (toolCounts.get(v.toolSlug) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, limit = 6): AnalyticsTopEntry[] =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, views]) => ({ key, label: key, views }));

  const topTools: AnalyticsTopEntry[] = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([slug, views]) => ({ key: slug, label: slug, views }));

  const payload: AnalyticsDashboardResponse = {
    totals: {
      views: totalViews,
      sessions: totalSessions,
      views7d: daily.slice(-7).reduce((s, p) => s + p.views, 0),
      views30d,
      viewsToday,
    },
    daily,
    topPages: top(pageCounts),
    topReferrers: top(referrerCounts),
    topTools,
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      actorType: a.actorType,
      actorId: a.actorId,
      details: a.details,
      ip: a.ip,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  return NextResponse.json(payload);
}
