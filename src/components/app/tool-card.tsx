"use client";

import { ArrowRight } from "lucide-react";
import { CategoryIcon } from "./category-icon";
import { PricingBadge, TrialBadge } from "./pricing-badge";
import type { ToolDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ToolCard({
  tool,
  onClick,
  className,
}: {
  tool: ToolDTO;
  onClick?: () => void;
  className?: string;
}) {
  const firstUseCase = tool.useCases.split(",")[0]?.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${tool.name} — view details`}
      className={cn(
        "group flex h-full flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CategoryIcon icon={tool.category?.icon} className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {tool.category?.name ?? "Uncategorized"}
            </p>
            <h3 className="truncate font-semibold leading-tight">{tool.name}</h3>
          </div>
        </div>
        <PricingBadge model={tool.pricingModel} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {tool.shortDescription}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        {tool.hasFreeTrial ? (
          <TrialBadge note={tool.trialNote} />
        ) : firstUseCase ? (
          <span className="truncate text-xs text-muted-foreground/80">e.g. {firstUseCase}</span>
        ) : (
          <span />
        )}
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
          Details
          <ArrowRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </button>
  );
}
