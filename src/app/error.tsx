"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary — catches anything the app throws during render
 * so visitors see a friendly recovery screen instead of Next's default crash
 * page. (The app is one route, so this covers everything below the root
 * layout; global-error.tsx covers layout-level failures.)
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest for support requests without exposing internals.
    console.error("[app] render error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16" role="alert">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          An unexpected error interrupted this page. Try again — if it keeps
          happening, let the editors know via the contact form.
          {error.digest ? (
            <span className="mt-2 block font-mono text-xs text-muted-foreground/70">
              Reference: {error.digest}
            </span>
          ) : null}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </Button>
          {/* A plain link (full reload) is intentional here — it clears any
              broken client state left behind by the error. */}
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Go to homepage
          </a>
        </div>
      </div>
    </div>
  );
}
