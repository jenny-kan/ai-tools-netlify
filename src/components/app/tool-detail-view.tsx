"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  ExternalLink,
  Info,
  Lightbulb,
  SearchX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "./category-icon";
import { PricingBadge, TrialBadge } from "./pricing-badge";
import { ToolCard } from "./tool-card";
import { getToolDetail, ApiError } from "@/lib/api";
import { formatDate, type ToolDetailResponse } from "@/lib/types";
import { useDocumentTitle } from "@/hooks/use-document-title";
import type { AppNavigate } from "./use-app-route";
import { CopyLinkButton } from "./copy-link-button";

type LoadState = "loading" | "ok" | "not-found" | "error";

export function ToolDetailView({ slug, navigate }: { slug: string; navigate: AppNavigate }) {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<ToolDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // One unconditional hook call — the title adapts to the load state.
  useDocumentTitle(
    state === "ok" && data ? data.tool.name : state === "not-found" ? "Tool not found" : "Loading tool…"
  );

  // This component is keyed by slug in the shell, so it remounts per tool —
  // the "loading" initial state is always correct when the slug changes.
  useEffect(() => {
    let cancelled = false;
    getToolDetail(slug)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setState("not-found");
        } else {
          setErrorMessage(e instanceof Error ? e.message : "Something went wrong.");
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
          <div className="mt-6 h-56 animate-pulse rounded-xl border bg-card" />
        </div>
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
          <span className="rounded-full bg-muted p-4">
            <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">Tool not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This listing may have been archived or the link is incorrect.
          </p>
          <Button onClick={() => navigate({ view: "home" }, { scroll: true })} className="mt-5">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to all tools
          </Button>
        </div>
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
          <Button variant="outline" onClick={() => window.location.reload()} className="mt-5">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const { tool, related } = data;
  const useCaseList = tool.useCases
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate({ view: "home" }, { scroll: true })}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to all tools
        </Button>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 bg-primary/5 font-medium text-primary">
              <CategoryIcon icon={tool.category?.icon} className="size-3.5" />
              {tool.category?.name ?? "Uncategorized"}
            </Badge>
            <PricingBadge model={tool.pricingModel} />
            {tool.hasFreeTrial && <TrialBadge note={tool.trialNote} showNote />}
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{tool.name}</h1>
          <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
            {tool.shortDescription}
          </p>

          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
            Pricing checked {formatDate(tool.pricingLastChecked)}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base font-semibold">
              <a href={tool.officialUrl} target="_blank" rel="noopener noreferrer">
                Visit official website
                <ExternalLink className="size-4" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </Button>
            <CopyLinkButton label="Share" className="h-12 rounded-xl px-5" />
          </div>

          <div className="mt-8 space-y-4">
            <section aria-labelledby="what-it-does" className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 id="what-it-does" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                What it does
              </h2>
              <p className="mt-2 leading-relaxed text-foreground/90">
                {tool.description || tool.shortDescription}
              </p>
            </section>

            {tool.example && (
              <section
                aria-labelledby="try-this"
                className="rounded-xl border border-primary/25 bg-primary/5 p-5"
              >
                <h2
                  id="try-this"
                  className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"
                >
                  <Lightbulb className="size-4" aria-hidden="true" />
                  Try this
                </h2>
                <p className="mt-2 leading-relaxed text-foreground/90">{tool.example}</p>
              </section>
            )}

            {tool.freePlanLimits && (
              <section
                aria-labelledby="free-plan-limits"
                className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-5 dark:border-amber-800/50 dark:bg-amber-950/30"
              >
                <h2
                  id="free-plan-limits"
                  className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
                >
                  <Info className="size-4" aria-hidden="true" />
                  {tool.pricingModel === "FREE" ? "Free to use" : "Free plan limits"}
                </h2>
                <p className="mt-2 leading-relaxed text-foreground/90">{tool.freePlanLimits}</p>
              </section>
            )}

            {useCaseList.length > 0 && (
              <section aria-labelledby="use-cases" className="rounded-xl border bg-card p-5 shadow-sm">
                <h2
                  id="use-cases"
                  className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Good for
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {useCaseList.map((u) => (
                    <li
                      key={u}
                      className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground"
                    >
                      {u}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-tools" className="mt-12">
            <h2 id="related-tools" className="text-lg font-semibold tracking-tight">
              More in {tool.category?.name}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {related.map((t) => (
                <ToolCard
                  key={t.id}
                  tool={t}
                  onClick={() =>
                    navigate({ view: "tool", toolSlug: t.slug }, { scroll: true })
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
