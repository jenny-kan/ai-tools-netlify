"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Theme toggle with CSS-driven icon swap (no mounted state, no hydration
 * flicker — the icon depends purely on the `.dark` class on <html>).
 *
 * The aria-label is intentionally static: `resolvedTheme` is undefined during
 * SSR, so deriving the label from it would produce different server/client
 * HTML and trigger a hydration mismatch. The next theme is resolved inside
 * the click handler instead, where the client value is always correct.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground"
      aria-label="Toggle light/dark theme"
      title="Toggle light/dark theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
    </Button>
  );
}
