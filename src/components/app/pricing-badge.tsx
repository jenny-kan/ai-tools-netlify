import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PRICING_LABELS,
  STATUS_LABELS,
  type PricingModel,
  type ToolStatus,
} from "@/lib/types";

const PRICING_STYLES: Record<PricingModel, string> = {
  FREE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300",
  FREEMIUM:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300",
  PAID: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-600/60 dark:bg-zinc-800/60 dark:text-zinc-300",
};

export function PricingBadge({
  model,
  className,
}: {
  model: PricingModel;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 font-medium", PRICING_STYLES[model], className)}
    >
      {PRICING_LABELS[model]}
    </Badge>
  );
}

/** Free trials are indicated separately from the Free/Freemium/Paid label. */
export function TrialBadge({ note, showNote = false }: { note?: string; showNote?: boolean }) {
  return (
    <Badge
      variant="outline"
      title={note || "This tool offers a free trial"}
      className={cn(
        "shrink-0 gap-1 border-dashed border-amber-300/80 bg-amber-50/60 font-medium text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300",
        showNote ? "" : "text-xs"
      )}
    >
      <Zap className="size-3" aria-hidden="true" />
      Free trial{showNote && note ? ` — ${note}` : ""}
    </Badge>
  );
}

const STATUS_STYLES: Record<ToolStatus, string> = {
  PUBLISHED:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300",
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300",
  ARCHIVED:
    "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-600/60 dark:bg-zinc-800/60 dark:text-zinc-300",
};

export function StatusBadge({ status }: { status: ToolStatus }) {
  return (
    <Badge variant="outline" className={cn("shrink-0 gap-1.5 font-medium", STATUS_STYLES[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
