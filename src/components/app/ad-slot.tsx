"use client";

import { Megaphone } from "lucide-react";
import type { AppNavigate } from "./use-app-route";

/**
 * Ad slot placeholder — clearly labelled, tasteful, and it doubles as the
 * "advertise with us" lead generator (jumps to the contact form).
 * Swap the inner content for a real ad network tag when monetization goes live.
 */
export function AdSlot({ navigate, className }: { navigate: AppNavigate; className?: string }) {
  return (
    <aside
      aria-label="Advertisement"
      className={
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center " +
        (className ?? "")
      }
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Megaphone className="size-4" aria-hidden="true" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advertisement</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your product in front of thousands of AI-curious makers every month.
      </p>
      <button
        type="button"
        onClick={() => navigate({ view: "contact" }, { scroll: true })}
        className="mt-1 rounded-full border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Advertise with us
      </button>
    </aside>
  );
}
