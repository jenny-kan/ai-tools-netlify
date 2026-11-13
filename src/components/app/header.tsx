"use client";

import { Heart, Mail, Newspaper, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import type { AppNavigate, RouteState } from "./use-app-route";

export function Header({ route, navigate }: { route: RouteState; navigate: AppNavigate }) {
  const onCatalog = route.view === "home" || route.view === "tool";
  const onBlog = route.view === "blog" || route.view === "blogpost";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => navigate({ view: "home" }, { scroll: true })}
          className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="ai tools central — home"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-4" />
          </span>
          {/* Wordmark collapses to just the icon on the smallest screens so
              the nav row never overflows horizontally (no layout shift). */}
          <span className="hidden text-base font-semibold tracking-tight min-[420px]:inline">
            ai tools central
          </span>
        </button>

        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Main navigation">
          <Button
            variant="ghost"
            size="sm"
            aria-current={onCatalog ? "page" : undefined}
            className={onCatalog ? "font-medium text-foreground" : "text-muted-foreground"}
            onClick={() => navigate({ view: "home" }, { scroll: true })}
          >
            Browse
          </Button>
          <Button
            variant={onBlog ? "default" : "ghost"}
            size="sm"
            aria-current={onBlog ? "page" : undefined}
            onClick={() => navigate({ view: "blog" }, { scroll: true })}
            aria-label="AI tool blog — guides and how-tos"
          >
            <Newspaper className="size-4" />
            <span className="hidden sm:inline">Blog</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-current={route.view === "blogger" ? "page" : undefined}
            className={route.view === "blogger" ? "font-medium text-foreground" : "text-muted-foreground"}
            onClick={() => navigate({ view: "blogger" }, { scroll: true })}
            aria-label="Blogger studio — sign in or apply to write"
          >
            <PenLine className="size-4" />
            <span className="hidden md:inline">Write</span>
          </Button>
          <Button
            variant={route.view === "donate" ? "default" : "ghost"}
            size="sm"
            aria-current={route.view === "donate" ? "page" : undefined}
            className={route.view === "donate" ? "text-rose-50" : "text-rose-500 hover:text-rose-600"}
            onClick={() => navigate({ view: "donate" }, { scroll: true })}
            aria-label="Support us with a donation"
          >
            <Heart className="size-4" />
            <span className="hidden lg:inline">Donate</span>
          </Button>
          <Button
            variant={route.view === "contact" ? "default" : "ghost"}
            size="sm"
            aria-current={route.view === "contact" ? "page" : undefined}
            onClick={() => navigate({ view: "contact" }, { scroll: true })}
            aria-label="Contact the editors"
          >
            <Mail className="size-4" />
            <span className="hidden sm:inline">Contact</span>
          </Button>
          <Button
            variant={route.view === "admin" ? "default" : "outline"}
            size="sm"
            aria-current={route.view === "admin" ? "page" : undefined}
            onClick={() => navigate({ view: "admin" }, { scroll: true })}
            aria-label="Open admin dashboard"
          >
            <ShieldCheck className="size-4" />
            <span className="hidden sm:inline">Admin</span>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
