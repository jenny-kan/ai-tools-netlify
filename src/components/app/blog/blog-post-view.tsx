"use client";

import { useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  ArrowLeft,
  CalendarDays,
  Heart,
  PenLine,
  SearchX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBlogPost, ApiError } from "@/lib/api";
import {
  formatDate,
  type BlogPostDetailResponse,
  type BlogPostSummary,
} from "@/lib/types";
import type { AppNavigate } from "../use-app-route";
import { AdSlot } from "../ad-slot";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { CopyLinkButton } from "../copy-link-button";
import { safeJsonLd } from "@/lib/utils";

type LoadState = "loading" | "ok" | "not-found" | "error";

/**
 * Public article page. Renders the post's markdown with react-markdown —
 * raw HTML in the content is escaped by default (no rehype-raw), which is
 * exactly the security posture we want for blogger-authored content.
 */
export function BlogPostView({ slug, navigate }: { slug: string; navigate: AppNavigate }) {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<BlogPostDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // One unconditional hook call — the title adapts to the load state.
  useDocumentTitle(
    state === "ok" && data ? data.post.title : state === "not-found" ? "Post not found" : "Loading article…"
  );

  // Keyed by slug in the app shell, so we remount per post — "loading" is
  // always the correct initial state when the slug changes.
  useEffect(() => {
    let cancelled = false;
    getBlogPost(slug)
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
      <div
        className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6"
        role="status"
        aria-label="Loading article"
      >
        <div className="mx-auto max-w-3xl">
          <div className="h-8 w-32 animate-pulse rounded-md bg-muted" aria-hidden="true" />
          <div className="mt-6 h-10 w-3/4 animate-pulse rounded-md bg-muted" aria-hidden="true" />
          <div className="mt-3 h-4 w-1/2 animate-pulse rounded-md bg-muted" aria-hidden="true" />
          <div className="mt-8 h-72 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
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
          <h1 className="mt-4 text-xl font-semibold">Post not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This article may have been unpublished or the link is incorrect.
          </p>
          <Button
            onClick={() => navigate({ view: "blog" }, { scroll: true })}
            className="mt-5"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            All articles
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

  const { post, related } = data;
  const readMinutes = Math.max(1, Math.round(post.content.split(/\s+/).length / 200));
  const publishedLabel = formatDate(post.publishedAt ?? post.updatedAt);
  const initials =
    post.author.name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const openPost = (p: BlogPostSummary) =>
    navigate({ view: "blogpost", postSlug: p.slug }, { scroll: true });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      {/* SEO structured data — safeJsonLd escapes `<` so blogger-controlled
          fields (title/tags/author) can't break out of the script block. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            author: { "@type": "Person", name: post.author.name },
            keywords: post.tags.join(", "),
          }),
        }}
      />

      <article className="mx-auto max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate({ view: "blog" }, { scroll: true })}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All articles
        </Button>

        <header className="mt-4">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <PenLine className="size-4 text-primary" aria-hidden="true" />
              <span className="font-medium text-foreground">{post.author.name}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              {publishedLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>{readMinutes} min read</span>
          </div>

          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="font-normal text-muted-foreground"
                >
                  {t}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-4">
            <CopyLinkButton label="Share this article" />
          </div>
        </header>

        {/* Markdown body — raw HTML is escaped; links open safely in a new tab. */}
        <div className="mt-8">
          <ReactMarkdown components={markdownComponents}>{post.content}</ReactMarkdown>
        </div>

        {/* ------------------------------------------------------ author card */}
        <Card className="mt-10 py-0">
          <CardContent className="flex items-start gap-4 p-5">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{post.author.name}</p>
              {post.author.bio && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {post.author.bio}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --------------------------------------------------- related articles */}
        {related.length > 0 && (
          <section aria-labelledby="related-articles" className="mt-12">
            <h2 id="related-articles" className="text-lg font-semibold tracking-tight">
              Related articles
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {related.map((p) => (
                <Card
                  key={p.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openPost(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPost(p);
                    }
                  }}
                  aria-label={`Read article: ${p.title}`}
                  className="py-0 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <CardContent className="p-4">
                    <h3 className="line-clamp-1 font-semibold leading-snug">{p.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {p.excerpt}
                    </p>
                    <p className="mt-2.5 text-xs text-muted-foreground">
                      {p.author.name} · {formatDate(p.publishedAt ?? p.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ------------------------------------------------------ support banner */}
        <Card className="mt-10 border-rose-200/70 bg-rose-50/60 py-0 dark:border-rose-800/50 dark:bg-rose-950/30">
          <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500"
              >
                <Heart className="size-4" />
              </span>
              <div>
                <p className="font-semibold">Found this guide useful?</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Help us write more — reader donations keep guides like this free.
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate({ view: "donate" }, { scroll: true })}
              className="shrink-0"
            >
              <Heart className="size-4" aria-hidden="true" />
              Support the blog
            </Button>
          </CardContent>
        </Card>

        <AdSlot navigate={navigate} className="mt-8" />
      </article>
    </div>
  );
}

/**
 * Tailwind-styled component mappers for react-markdown. Block code gets its
 * chrome from the `pre` mapper — the `[&_code]` resets undo the inline-code
 * styling for fenced blocks (with or without a language tag).
 */
const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="mt-10 mb-3 text-2xl font-bold tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-2 text-xl font-semibold tracking-tight">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-4 leading-relaxed text-muted-foreground">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-1 pl-6 text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-1 pl-6 text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-6 border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-xl border bg-muted p-4 font-mono text-sm [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-8 border-border" />,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2">
        {children}
      </table>
    </div>
  ),
};
