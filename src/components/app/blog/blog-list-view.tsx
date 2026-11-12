"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Newspaper,
  PenLine,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getBlogPosts, ApiError } from "@/lib/api";
import { formatDate, type BlogPostSummary } from "@/lib/types";
import { useDocumentTitle } from "@/hooks/use-document-title";
import type { AppNavigate } from "../use-app-route";
import { AdSlot } from "../ad-slot";
import { cn } from "@/lib/utils";

/**
 * Public blog index — hero, client-side tag + search filters, featured post,
 * article grid with a "write for us" CTA card and an ad slot at the bottom.
 */
export function BlogListView({ navigate }: { navigate: AppNavigate }) {
  const [posts, setPosts] = useState<BlogPostSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useDocumentTitle(activeTag ? `Blog — ${activeTag}` : "Blog — AI tool guides & how-tos");

  const [reloadKey, setReloadKey] = useState(0);

  // Initial fetch + retry. State updates happen in async callbacks only —
  // never synchronously inside the effect body.
  useEffect(() => {
    let cancelled = false;
    getBlogPosts()
      .then((res) => {
        if (!cancelled) setPosts(res.posts);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Couldn't load articles."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoadError(null);
    setPosts(null);
    setReloadKey((k) => k + 1);
  };

  /** Every tag used across published posts, most common first. */
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts ?? []) {
      for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t]) => t);
  }, [posts]);

  /** Client-side filtering: active tag chip + free-text over title/excerpt/author. */
  const filtered = useMemo(() => {
    if (!posts) return [];
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (activeTag && !p.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.author.name.toLowerCase().includes(q)
      );
    });
  }, [posts, activeTag, query]);

  const featured = filtered[0] ?? null;
  const rest = filtered.slice(1);
  const openPost = (slug: string) => navigate({ view: "blogpost", postSlug: slug }, { scroll: true });
  const openApply = () => navigate({ view: "blogger", mode: "signup" }, { scroll: true });
  const hasFilters = activeTag !== null || query.trim() !== "";
  const clearFilters = () => {
    setActiveTag(null);
    setQuery("");
  };

  return (
    <div>
      {/* ------------------------------------------------------------- hero */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl pb-8 pt-10 text-center sm:pt-14">
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground"
          >
            <PenLine className="size-3.5 text-primary" aria-hidden="true" />
            Guides &amp; how-tos
          </Badge>
          <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Get more out of AI tools
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Practical, step-by-step guides written by people who use these tools
            every day — no hype, just workflows that work.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------- tag + search bar */}
      <div className="sticky top-14 z-30 border-y bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
          {posts && posts.length > 0 ? (
            <div
              className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none"
              role="group"
              aria-label="Filter articles by tag"
            >
              <TagChip active={activeTag === null} onClick={() => setActiveTag(null)}>
                All topics
              </TagChip>
              {allTags.map((t) => (
                <TagChip
                  key={t}
                  active={activeTag === t}
                  onClick={() => setActiveTag(activeTag === t ? null : t)}
                >
                  {t}
                </TagChip>
              ))}
            </div>
          ) : (
            <span className="flex-1" />
          )}

          <div className="relative shrink-0 sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles…"
              aria-label="Search articles by title or author"
              className="h-9 rounded-full border-border bg-card pl-9 pr-12"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- results */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6" aria-live="polite">
        {posts === null && !loadError ? (
          <div role="status" aria-label="Loading articles" className="space-y-4">
            <div className="h-40 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-xl border bg-card"
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
            <AlertTriangle className="size-8 text-amber-500" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">Couldn’t load articles</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{loadError}</p>
            <Button onClick={retry} className="mt-4">
              <ArrowLeft className="size-4 rotate-180" aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : posts && posts.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
            <span className="rounded-full bg-muted p-4">
              <Newspaper className="size-8 text-muted-foreground" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-semibold">No articles yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              No articles yet — be the first to write one. Apply to blog and share
              your AI workflows with thousands of readers.
            </p>
            <Button onClick={openApply} className="mt-5">
              <PenLine className="size-4" aria-hidden="true" />
              Apply to blog
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
            <span className="rounded-full bg-muted p-4">
              <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-semibold">No articles match</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Try different words, or clear the tag and search filters.
            </p>
            <Button variant="outline" onClick={clearFilters} className="mt-5">
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ---------------------------------------------- featured post */}
            {featured && (
              <Card
                role="link"
                tabIndex={0}
                onClick={() => openPost(featured.slug)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPost(featured.slug);
                  }
                }}
                aria-label={`Read featured article: ${featured.title}`}
                className="border-l-4 border-l-primary py-0 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="gap-1 border-primary/30 bg-primary/5 font-medium text-primary"
                    >
                      Featured
                    </Badge>
                    {featured.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline" className="font-normal text-muted-foreground">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <h2 className="mt-3 text-balance text-xl font-semibold leading-snug sm:text-2xl">
                    {featured.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-pretty text-muted-foreground">
                    {featured.excerpt}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{featured.author.name}</span>
                    {" · "}
                    {formatDate(featured.publishedAt ?? featured.updatedAt)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* --------------------------------------------- remaining grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <Card
                  key={p.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openPost(p.slug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPost(p.slug);
                    }
                  }}
                  aria-label={`Read article: ${p.title}`}
                  className="py-0 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <CardContent className="flex h-full flex-col p-5">
                    <h3 className="line-clamp-1 font-semibold leading-snug">{p.title}</h3>
                    <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">
                      {p.excerpt}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{p.author.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(p.publishedAt ?? p.updatedAt)}</span>
                    </div>
                    {p.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.tags.slice(0, 4).map((t) => (
                          <Badge
                            key={t}
                            variant="outline"
                            className="px-2 py-0 text-[11px] font-normal text-muted-foreground"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* ---------------------------------------- write-for-us CTA */}
              <button
                type="button"
                onClick={openApply}
                className="flex min-h-44 flex-col items-start justify-center gap-2 rounded-xl border border-dashed p-5 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PenLine className="size-4" aria-hidden="true" />
                </span>
                <h3 className="font-semibold">Write for us</h3>
                <p className="text-sm text-muted-foreground">
                  Share your AI workflows — apply to blog and publish guides here.
                </p>
                <span className="mt-1 text-sm font-medium text-primary">
                  Apply to blog →
                </span>
              </button>
            </div>
          </div>
        )}

        <AdSlot navigate={navigate} className="mt-10" />
      </section>
    </div>
  );
}

function TagChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
