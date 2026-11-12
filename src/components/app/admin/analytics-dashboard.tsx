"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Eye,
  LineChart,
  RotateCw,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminAnalytics } from "@/lib/api";
import { formatDate, type AnalyticsDashboardResponse, type AnalyticsTopEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTOR_BADGE_STYLES: Record<string, string> = {
  admin: "border-emerald-300/60 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-300",
  blogger: "border-amber-300/60 text-amber-700 dark:border-amber-700/60 dark:text-amber-300",
  visitor: "border-border text-muted-foreground",
};

function formatShortDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "3h ago"-style label; hover title carries the full date + time. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function fullTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDate(iso)} · ${d.toLocaleTimeString()}`;
}

/** Privacy-friendly traffic dashboard: pure CSS charts, no client-side tracking data. */
export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await getAdminAnalytics());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading analytics">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-accent" aria-hidden="true" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
          ))}
        </div>
        <div className="h-60 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">{loadError ?? "Analytics data is unavailable."}</p>
        <Button variant="outline" onClick={() => void load()} className="mt-3">
          Try again
        </Button>
      </div>
    );
  }

  const daily = data.daily;
  const maxViews = Math.max(...daily.map((d) => d.views), 1);
  const peak = daily.reduce((best, d) => (d.views > best.views ? d : best), daily[0]);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <BarChart3 className="size-4 text-primary" aria-hidden="true" />
            Traffic &amp; audience
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Privacy-friendly page-view analytics — no cookies, no PII.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RotateCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total views" value={data.totals.views} icon={<Eye className="size-4" />} />
        <StatCard label="Unique sessions" value={data.totals.sessions} icon={<Users className="size-4" />} />
        <StatCard label="Today" value={data.totals.viewsToday} icon={<Sun className="size-4" />} />
        <StatCard label="Last 7 days" value={data.totals.views7d} icon={<TrendingUp className="size-4" />} />
        <StatCard label="Last 30 days" value={data.totals.views30d} icon={<LineChart className="size-4" />} />
      </div>

      {/* last 14 days — pure CSS bars, no chart library (hydration-safe) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last 14 days</CardTitle>
          <CardDescription>
            Peak: {maxViews.toLocaleString()} {maxViews === 1 ? "view" : "views"}
            {peak && ` on ${formatShortDate(peak.date)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1">
            {daily.map((d) => (
              <div
                key={d.date}
                role="img"
                aria-label={`${formatShortDate(d.date)}: ${d.views} ${d.views === 1 ? "view" : "views"}`}
                title={`${d.date}: ${d.views} ${d.views === 1 ? "view" : "views"}`}
                className={cn(
                  "min-w-0 flex-1 rounded-t transition-colors",
                  d.views > 0 ? "bg-primary/80 hover:bg-primary" : "bg-primary/15"
                )}
                style={{ height: d.views > 0 ? `max(${(d.views / maxViews) * 100}%, 2px)` : "2px" }}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {daily.map((d, i) => (
              <span
                key={d.date}
                className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground"
              >
                {i % 2 === 0 ? formatShortDate(d.date) : ""}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* top lists */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TopListCard
          title="Top pages"
          description="Most viewed paths over the last 14 days."
          entries={data.topPages}
        />
        <TopListCard
          title="Top referrers"
          description="Where visitors came from over the last 14 days."
          entries={data.topReferrers}
        />
        <TopListCard
          title="Top tools"
          description="Tool detail pages with the most views."
          entries={data.topTools}
        />
      </div>

      {/* audit trail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Security &amp; audit trail
          </CardTitle>
          <CardDescription>The 10 most recent privileged actions recorded by the server.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentAudit.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No audit events yet.</p>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto scrollbar-slim">
              {data.recentAudit.slice(0, 10).map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="font-mono text-xs font-medium">{entry.action}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize",
                      ACTOR_BADGE_STYLES[entry.actorType] ?? ACTOR_BADGE_STYLES.visitor
                    )}
                  >
                    {entry.actorType}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={entry.details}>
                    {entry.details || "—"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{entry.ip}</span>
                  <time
                    dateTime={entry.createdAt}
                    title={fullTime(entry.createdAt)}
                    className="text-xs text-muted-foreground"
                  >
                    {relativeTime(entry.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Full audit trail is persisted server-side (OWASP A09).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ internals

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value.toLocaleString()}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TopListCard({
  title,
  description,
  entries,
}: {
  title: string;
  description: string;
  entries: AnalyticsTopEntry[];
}) {
  const max = Math.max(...entries.map((e) => e.views), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-mono text-xs" title={entry.label}>
                    {entry.label}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {entry.views.toLocaleString()}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={max}
                  aria-valuenow={entry.views}
                  aria-label={`${entry.label}: ${entry.views} views`}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max((entry.views / max) * 100, 3)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
