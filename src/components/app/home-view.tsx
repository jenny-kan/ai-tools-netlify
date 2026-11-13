"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw, Search, SearchX, Sparkles, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppData } from "./data-context";
import { ToolCard } from "./tool-card";
import { searchTools, sortByName } from "@/lib/search";
import { useDocumentTitle } from "@/hooks/use-document-title";
import type { AppNavigate, RouteState } from "./use-app-route";
import { cn, safeJsonLd } from "@/lib/utils";

const SUGGESTIONS = [
  "transcribe a meeting",
  "write a blog post",
  "generate images",
  "make a song",
  "summarize a PDF",
  "automate my workflow",
  "help with homework",
  "fix a bug in my code",
];

const PRICING_FILTERS = [
  { value: "all", label: "All pricing" },
  { value: "FREE", label: "Free" },
  { value: "FREEMIUM", label: "Freemium" },
  { value: "PAID", label: "Paid" },
] as const;

/** Select option for the free-trial filter (combined into the same dropdown). */
const TRIAL_VALUE = "TRIAL";

export function HomeView({ route, navigate }: { route: RouteState; navigate: AppNavigate }) {
  const { tools, categories, loading, error, refresh } = useAppData();
  const [query, setQuery] = useState(route.q);
  // Track the last route.q seen so we can re-sync the input when the URL
  // changes externally (back button, footer links) — the recommended
  // "adjust state during render" pattern instead of an effect.
  const [lastRouteQ, setLastRouteQ] = useState(route.q);
  if (route.q !== lastRouteQ) {
    setLastRouteQ(route.q);
    setQuery(route.q);
  }
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" anywhere focuses the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.key === "/" &&
        target &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sync the URL (debounced, no history spam) while filtering happens instantly on `query`.
  useEffect(() => {
    const t = setTimeout(() => {
      if (query !== route.q) navigate({ q: query }, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [query, route.q, navigate]);

  const filtered = useMemo(() => {
    const searched = searchTools(tools, query);
    const ordered = query ? searched : sortByName(searched);
    let list = ordered;
    if (route.cat !== "all") list = list.filter((t) => t.category?.slug === route.cat);
    if (route.price !== "all") list = list.filter((t) => t.pricingModel === route.price);
    if (route.trial) list = list.filter((t) => t.hasFreeTrial);
    return list;
  }, [tools, query, route.cat, route.price, route.trial]);

  const activeCategory = categories.find((c) => c.slug === route.cat);
  const hasActiveFilters =
    query.trim() !== "" || route.cat !== "all" || route.price !== "all" || route.trial;

  // Descriptive title per filter state — better history entries, bookmarks,
  // and screen-reader context than a generic "Home".
  const titlePart = query.trim()
    ? `“${query.trim()}”`
    : activeCategory
      ? `${activeCategory.name} AI tools`
      : route.trial
        ? "AI tools with a free trial"
        : route.price !== "all"
          ? `${route.price.toLowerCase()} AI tools`
          : null;
  useDocumentTitle(titlePart);

  const resetFilters = () => {
    setQuery("");
    navigate({ q: "", cat: "all", price: "all", trial: false });
  };

  return (
    <div>
      {/* SEO structured data: WebSite + catalog ItemList. safeJsonLd escapes
          `<` so nothing can break out of the script block. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // NOTE: no `typeof window` branch here — the target must be byte-
          // identical on server and client or React flags a hydration
          // mismatch. NEXT_PUBLIC_* vars are inlined at build time on both
          // sides, so this is stable; crawlers resolve relative targets
          // against the page URL.
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "ai tools central",
            description:
              "A hand-checked directory of free and paid AI tools — describe a task and find the right AI tool, with free-plan limits and pricing.",
            potentialAction: {
              "@type": "SearchAction",
              target: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }),
        }}
      />
      {/* ------------------------------------------------------------- hero */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl pb-8 pt-10 text-center sm:pt-14">
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground"
          >
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            {loading
              ? "Loading catalog…"
              : `${tools.length} verified tools · ${categories.length} categories`}
          </Badge>

          <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            What do you want to do?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Describe a task — like “transcribe a meeting” — and instantly find AI tools that do it,
            with free-plan details and pricing.
          </p>

          <form
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className="relative mt-6"
          >
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. transcribe a meeting, generate images, write code…"
              aria-label="What do you want to do? Search AI tools"
              className="h-14 w-full rounded-2xl border bg-card pl-12 pr-24 text-base shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-16 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            )}
            <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
              /
            </kbd>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  searchRef.current?.focus();
                }}
                className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- filter bar */}
      <div className="sticky top-14 z-30 border-y bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
            <FilterPill active={route.cat === "all"} onClick={() => navigate({ cat: "all" })}>
              All
            </FilterPill>
            {categories.map((c) => (
              <FilterPill
                key={c.id}
                active={route.cat === c.slug}
                onClick={() => navigate({ cat: route.cat === c.slug ? "all" : c.slug })}
              >
                {c.name}
              </FilterPill>
            ))}
          </div>

          {/* Cost filters live in a dropdown so they're always visible,
              even on narrow screens where pill rows overflow. */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Select
              value={route.trial ? TRIAL_VALUE : route.price}
              onValueChange={(v) => {
                if (v === TRIAL_VALUE) navigate({ trial: true, price: "all" });
                else navigate({ trial: false, price: v });
              }}
            >
              <SelectTrigger
                aria-label="Filter by cost"
                className="h-8 w-[124px] shrink-0 rounded-full border-border bg-card text-xs font-medium data-[size=default]:h-8"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Zap className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {PRICING_FILTERS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value={TRIAL_VALUE} className="text-xs">
                  Free trial available
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Always rendered — disabled when idle — so enabling/disabling
                filters never shifts the bar's layout (no appearing button). */}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              aria-disabled={!hasActiveFilters}
              title={hasActiveFilters ? "Clear search and filters" : "No filters active"}
              className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- results */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6" aria-live="polite">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {loading ? (
              "Loading tools…"
            ) : (
              <>
                <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
                {filtered.length === 1 ? "tool" : "tools"}
                {query.trim() && (
                  <>
                    {" "}
                    matching <span className="font-medium text-foreground">“{query.trim()}”</span>
                  </>
                )}
                {activeCategory && (
                  <>
                    {" "}
                    in <span className="font-medium text-foreground">{activeCategory.name}</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl border bg-card shadow-sm"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
            <AlertTriangle className="size-8 text-amber-500" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">Couldn’t load the catalog</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => void refresh()} className="mt-4">
              <ArrowLeft className="size-4 rotate-180" aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
            <span className="rounded-full bg-muted p-4">
              <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-semibold">No tools match your search</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Try different words or clear the filters. Popular tasks:
            </p>
            <div className="mt-4 flex max-w-md flex-wrap justify-center gap-2">
              {SUGGESTIONS.slice(0, 5).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setQuery(s);
                    navigate({ q: s, cat: "all", price: "all", trial: false });
                  }}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={resetFilters} className="mt-5">
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset all filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onClick={() => navigate({ view: "tool", toolSlug: tool.slug }, { scroll: true })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterPill({
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
