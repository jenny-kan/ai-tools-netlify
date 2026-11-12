"use client";

import { Download, FileSpreadsheet, Heart, Sparkles } from "lucide-react";
import { useAppData } from "./data-context";
import type { AppNavigate } from "./use-app-route";

const footerLinkClass =
  "text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

export function Footer({ navigate }: { navigate: AppNavigate }) {
  const { tools, categories } = useAppData();

  return (
    <footer className="mt-auto border-t bg-muted/40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <span className="font-semibold">AI Tool Finder</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              A hand-checked directory of free and paid AI tools. Describe a task, compare free
              plans, and jump straight to the official website.
            </p>
            <div className="mt-4 flex flex-col items-start gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-rose-500 transition-colors hover:border-rose-300 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigate({ view: "donate" }, { scroll: true })}
              >
                <Heart className="size-3.5" aria-hidden="true" />
                Support us — donate
              </button>
              <a
                href="/api/download"
                download
                title="Clean, deploy-ready .zip — source, configs and docs. No secrets, no database, no git history."
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Download source package
              </a>
              <a
                href="/api/tools/export"
                download
                title="All published tools as a spreadsheet-friendly CSV (Excel / Google Sheets)."
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FileSpreadsheet className="size-3.5" aria-hidden="true" />
                Download tools as CSV
              </a>
            </div>
          </div>

          <nav aria-label="Browse categories">
            <h2 className="text-sm font-semibold">Browse</h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {categories.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={footerLinkClass}
                    onClick={() => navigate({ view: "home", cat: c.slug }, { scroll: true })}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold">Blog &amp; community</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <button type="button" className={footerLinkClass} onClick={() => navigate({ view: "blog" }, { scroll: true })}>
                  AI tool guides &amp; how-tos
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={footerLinkClass}
                  onClick={() => navigate({ view: "blogger", mode: "signup" }, { scroll: true })}
                >
                  Write for us — apply now
                </button>
              </li>
              <li>
                <button type="button" className={footerLinkClass} onClick={() => navigate({ view: "blogger" }, { scroll: true })}>
                  Blogger sign in
                </button>
              </li>
              <li>
                <button type="button" className={footerLinkClass} onClick={() => navigate({ view: "admin" }, { scroll: true })}>
                  Admin dashboard
                </button>
              </li>
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Applications are reviewed by the editors within 48 hours; every post passes an
              editorial quality check before publishing.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Get in touch</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <button type="button" className={footerLinkClass} onClick={() => navigate({ view: "contact" }, { scroll: true })}>
                  Contact &amp; feedback
                </button>
              </li>
              <li>
                <button type="button" className={footerLinkClass} onClick={() => navigate({ view: "contact" }, { scroll: true })}>
                  Suggest an AI tool
                </button>
              </li>
              <li>
                <button type="button" className={footerLinkClass} onClick={() => navigate({ view: "contact" }, { scroll: true })}>
                  Advertise with us
                </button>
              </li>
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Know a great free AI tool we&apos;re missing? Tell us — suggestions are reviewed by the
              editors.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} AI Tool Finder · {tools.length} curated tools ·{" "}
            {categories.length} categories
          </span>
          <span>
            Privacy-friendly analytics — no cookies, no tracking pixels · Built with Next.js, Prisma
            &amp; shadcn/ui
          </span>
        </div>
      </div>
    </footer>
  );
}
