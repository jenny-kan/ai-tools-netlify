"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Newspaper,
  Rocket,
  UserPlus,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { decideApplication, getAdminBlogOverview, reviewBlogPost } from "@/lib/api";
import {
  BLOG_POST_STATUS_LABELS,
  BLOGGER_STATUS_LABELS,
  formatDate,
  type AdminBlogOverviewDTO,
  type BloggerApplicationDTO,
  type BloggerStatus,
  type BlogPostDTO,
  type BlogPostStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type PostFilter = BlogPostStatus | "all";

const APP_STATUS_STYLES: Record<BloggerStatus, string> = {
  PENDING: "border-amber-300/60 text-amber-700 dark:border-amber-700/60 dark:text-amber-300",
  APPROVED: "border-emerald-300/60 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-300",
  REJECTED: "border-rose-300/60 text-rose-700 dark:border-rose-700/60 dark:text-rose-300",
  SUSPENDED: "border-border text-muted-foreground",
};

const POST_STATUS_STYLES: Record<BlogPostStatus, string> = {
  DRAFT: "border-border text-muted-foreground",
  SUBMITTED: "border-amber-300/60 text-amber-700 dark:border-amber-700/60 dark:text-amber-300",
  PUBLISHED: "border-emerald-300/60 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-300",
  REJECTED: "border-rose-300/60 text-rose-700 dark:border-rose-700/60 dark:text-rose-300",
};

const EMERALD_OUTLINE =
  "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 hover:text-emerald-800 dark:border-emerald-700/60 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-200";
const ROSE_OUTLINE =
  "border-rose-300/60 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 hover:text-rose-800 dark:border-rose-700/60 dark:text-rose-300 dark:hover:bg-rose-500/20 dark:hover:text-rose-200";

/** Tailwind mappers for the admin post preview (raw HTML stays escaped — no rehype-raw). */
const MARKDOWN_COMPONENTS: Components = {
  h2: ({ children }) => <h2 className="mb-3 mt-8 text-2xl font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-xl font-semibold">{children}</h3>,
  p: ({ children }) => <p className="mb-4 leading-relaxed text-muted-foreground">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-6">{children}</ol>,
  code: ({ children, className }) => (
    <code className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-sm", className)}>{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-xl border bg-muted p-4 font-mono text-sm">{children}</pre>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-2 border-primary/40 pl-4 italic text-muted-foreground">{children}</blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  hr: () => <hr className="my-8" />,
};

/** Admin review of blogger applications and the editorial post queue. */
export function BlogManager({ onChanged }: { onChanged?: () => void | Promise<void> }) {
  const [overview, setOverview] = useState<AdminBlogOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [postFilter, setPostFilter] = useState<PostFilter>("SUBMITTED");

  // application review
  const [approvingApp, setApprovingApp] = useState<BloggerApplicationDTO | null>(null);
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busyAppId, setBusyAppId] = useState<string | null>(null);

  // post review
  const [previewPost, setPreviewPost] = useState<BlogPostDTO | null>(null);
  const [publishingPost, setPublishingPost] = useState<BlogPostDTO | null>(null);
  const [unpublishingPost, setUnpublishingPost] = useState<BlogPostDTO | null>(null);
  const [changesPostId, setChangesPostId] = useState<string | null>(null);
  const [changesNote, setChangesNote] = useState("");
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setOverview(await getAdminBlogOverview());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load the blog overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Reload the overview plus whatever the parent dashboard tracks (public data). */
  const afterAction = useCallback(async () => {
    await Promise.all([load(), onChanged?.()]);
  }, [load, onChanged]);

  const pendingApps = useMemo(
    () =>
      (overview?.applications ?? [])
        .filter((a) => a.status === "PENDING")
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)),
    [overview]
  );

  const decidedApps = useMemo(
    () =>
      (overview?.applications ?? [])
        .filter((a) => a.status !== "PENDING")
        .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "")),
    [overview]
  );

  const posts = useMemo(() => overview?.posts ?? [], [overview]);

  const postCounts = useMemo(
    () => ({
      submitted: posts.filter((p) => p.status === "SUBMITTED").length,
      published: posts.filter((p) => p.status === "PUBLISHED").length,
      drafts: posts.filter((p) => p.status === "DRAFT").length,
      all: posts.length,
    }),
    [posts]
  );

  const visiblePosts = useMemo(
    () =>
      posts
        .filter((p) => postFilter === "all" || p.status === postFilter)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [posts, postFilter]
  );

  // ------------------------------------------------------------ application actions

  const confirmApprove = async () => {
    if (!approvingApp) return;
    const app = approvingApp;
    setBusyAppId(app.id);
    try {
      await decideApplication(app.id, "approve");
      toast.success(`${app.name} approved — they can sign in and start drafting`);
      setApprovingApp(null);
      await afterAction();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusyAppId(null);
    }
  };

  const confirmReject = async (app: BloggerApplicationDTO) => {
    setBusyAppId(app.id);
    try {
      await decideApplication(app.id, "reject", rejectNote.trim());
      toast.success(`Application from ${app.name} rejected`);
      setRejectingAppId(null);
      setRejectNote("");
      await afterAction();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rejection failed");
    } finally {
      setBusyAppId(null);
    }
  };

  // ----------------------------------------------------------------- post actions

  const confirmPublish = async () => {
    if (!publishingPost) return;
    const post = publishingPost;
    setBusyPostId(post.id);
    try {
      await reviewBlogPost(post.id, "publish");
      toast.success(`“${post.title}” is live`);
      setPublishingPost(null);
      await afterAction();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusyPostId(null);
    }
  };

  const confirmUnpublish = async () => {
    if (!unpublishingPost) return;
    const post = unpublishingPost;
    setBusyPostId(post.id);
    try {
      await reviewBlogPost(post.id, "unpublish");
      toast.success(`“${post.title}” unpublished — back in the review queue`);
      setUnpublishingPost(null);
      await afterAction();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unpublish failed");
    } finally {
      setBusyPostId(null);
    }
  };

  const confirmChanges = async (post: BlogPostDTO) => {
    setBusyPostId(post.id);
    try {
      await reviewBlogPost(post.id, "reject", changesNote.trim());
      toast.success(`Changes requested on “${post.title}”`);
      setChangesPostId(null);
      setChangesNote("");
      await afterAction();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t send the feedback");
    } finally {
      setBusyPostId(null);
    }
  };

  // ----------------------------------------------------------------------- render

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading blog applications and posts">
        <div className="h-44 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
        <div className="h-28 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
        <div className="h-28 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
      </div>
    );
  }

  if (loadError || !overview) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">{loadError ?? "Blog overview is unavailable."}</p>
        <Button variant="outline" onClick={() => void load()} className="mt-3">
          Try again
        </Button>
      </div>
    );
  }

  const filterChips: { value: PostFilter; label: string; count: number }[] = [
    { value: "SUBMITTED", label: "In review", count: postCounts.submitted },
    { value: "PUBLISHED", label: "Published", count: postCounts.published },
    { value: "DRAFT", label: "Drafts", count: postCounts.drafts },
    { value: "all", label: "All", count: postCounts.all },
  ];

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- applications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="size-4" aria-hidden="true" />
            </span>
            Blogger applications
            <Badge
              variant="outline"
              className={cn(
                "font-normal",
                pendingApps.length > 0
                  ? "border-amber-300/60 text-amber-700 dark:border-amber-700/60 dark:text-amber-300"
                  : "text-muted-foreground"
              )}
            >
              {pendingApps.length} pending
            </Badge>
          </CardTitle>
          <CardDescription>
            Read each writing sample carefully — approved applicants can sign in and start drafting immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingApps.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <UserPlus className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 font-medium">No open applications</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Share the “write for us” link to attract bloggers.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pendingApps.map((app) => {
                const busy = busyAppId === app.id;
                const rejecting = rejectingAppId === app.id;
                return (
                  <li key={app.id}>
                    <article
                      className={cn(
                        "space-y-3 rounded-xl border bg-card p-4 transition-opacity",
                        busy && "pointer-events-none opacity-60"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold leading-tight">{app.name}</h3>
                          <Badge variant="outline" className={cn("font-normal", APP_STATUS_STYLES[app.status])}>
                            {BLOGGER_STATUS_LABELS[app.status]}
                          </Badge>
                          {busy && (
                            <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Working…" />
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {app.email} · applied {formatDate(app.appliedAt)}
                        </p>
                      </div>

                      {app.applicationReason && (
                        <p className="text-sm text-muted-foreground">{app.applicationReason}</p>
                      )}
                      {app.bio && <p className="text-sm italic text-muted-foreground">{app.bio}</p>}

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Writing sample
                        </p>
                        <div className="max-h-72 overflow-y-auto scrollbar-slim rounded-lg border bg-muted/40 p-3">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{app.writingSample}</p>
                        </div>
                      </div>

                      {rejecting ? (
                        <div className="space-y-2 rounded-lg border border-rose-300/50 bg-rose-500/5 p-3 dark:border-rose-700/40">
                          <Textarea
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            rows={3}
                            placeholder="Optional feedback for the applicant…"
                            aria-label={`Rejection feedback for ${app.name}`}
                            autoFocus
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRejectingAppId(null);
                                setRejectNote("");
                              }}
                              disabled={busy}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="bg-rose-600 text-white hover:bg-rose-600/90"
                              onClick={() => void confirmReject(app)}
                              disabled={busy}
                            >
                              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                              Confirm rejection
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={EMERALD_OUTLINE}
                            onClick={() => setApprovingApp(app)}
                            disabled={busy}
                          >
                            <Check className="size-3.5" aria-hidden="true" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={ROSE_OUTLINE}
                            onClick={() => {
                              setRejectNote("");
                              setRejectingAppId(app.id);
                            }}
                            disabled={busy}
                          >
                            <X className="size-3.5" aria-hidden="true" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          {decidedApps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Decided ({decidedApps.length})
              </p>
              <ul className="space-y-2">
                {decidedApps.map((app) => (
                  <li
                    key={app.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <span className="text-sm font-medium">{app.name}</span>
                    <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline">
                      {app.email}
                    </span>
                    <Badge variant="outline" className={cn("font-normal", APP_STATUS_STYLES[app.status])}>
                      {BLOGGER_STATUS_LABELS[app.status]}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {app.decidedAt ? `decided ${formatDate(app.decidedAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------- posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Newspaper className="size-4" aria-hidden="true" />
            </span>
            Editorial review queue
          </CardTitle>
          <CardDescription>
            Preview submissions in full, publish them to the blog, or ask the author for changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter posts by status">
            {filterChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                aria-pressed={postFilter === chip.value}
                onClick={() => setPostFilter(chip.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  postFilter === chip.value
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {chip.label} ({chip.count})
              </button>
            ))}
          </div>

          {visiblePosts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Newspaper className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 font-medium">No posts in this view</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {postCounts.all === 0
                  ? "Approved bloggers can draft posts — they’ll appear here for review."
                  : "Try another filter to see more posts."}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visiblePosts.map((post) => {
                const busy = busyPostId === post.id;
                const changesOpen = changesPostId === post.id;
                return (
                  <li key={post.id}>
                    <article
                      className={cn(
                        "rounded-xl border bg-card p-4 transition-opacity",
                        busy && "pointer-events-none opacity-60"
                      )}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold leading-tight">{post.title}</h3>
                            <Badge
                              variant="outline"
                              className={cn("font-normal", POST_STATUS_STYLES[post.status])}
                            >
                              {BLOG_POST_STATUS_LABELS[post.status]}
                            </Badge>
                            {busy && (
                              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Working…" />
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            by {post.author.name} · updated {formatDate(post.updatedAt)}
                            {post.publishedAt ? ` · published ${formatDate(post.publishedAt)}` : ""}
                          </p>
                          {post.excerpt && (
                            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{post.excerpt}</p>
                          )}
                          {post.status === "REJECTED" && post.reviewNote && (
                            <Alert className="mt-3 border-amber-300/60 bg-amber-500/5 dark:border-amber-700/50">
                              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                              <AlertTitle className="text-amber-800 dark:text-amber-300">Changes requested</AlertTitle>
                              <AlertDescription className="text-amber-800/80 dark:text-amber-300/80">
                                {post.reviewNote}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:shrink-0">
                          <Button variant="outline" size="sm" onClick={() => setPreviewPost(post)} disabled={busy}>
                            <Eye className="size-3.5" aria-hidden="true" />
                            Preview
                          </Button>
                          {post.status === "SUBMITTED" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                                onClick={() => setPublishingPost(post)}
                                disabled={busy}
                              >
                                <Rocket className="size-3.5" aria-hidden="true" />
                                Publish
                              </Button>
                              {!changesOpen && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={ROSE_OUTLINE}
                                  onClick={() => {
                                    setChangesNote("");
                                    setChangesPostId(post.id);
                                  }}
                                  disabled={busy}
                                >
                                  <X className="size-3.5" aria-hidden="true" />
                                  Request changes
                                </Button>
                              )}
                            </>
                          )}
                          {post.status === "PUBLISHED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setUnpublishingPost(post)}
                              disabled={busy}
                            >
                              <EyeOff className="size-3.5" aria-hidden="true" />
                              Unpublish
                            </Button>
                          )}
                        </div>
                      </div>

                      {changesOpen && (
                        <div className="mt-3 space-y-2 rounded-lg border border-rose-300/50 bg-rose-500/5 p-3 dark:border-rose-700/40">
                          <Textarea
                            value={changesNote}
                            onChange={(e) => setChangesNote(e.target.value)}
                            rows={3}
                            placeholder="What should the author change before this can go live?"
                            aria-label={`Feedback for “${post.title}”`}
                            autoFocus
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setChangesPostId(null);
                                setChangesNote("");
                              }}
                              disabled={busy}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="bg-rose-600 text-white hover:bg-rose-600/90"
                              onClick={() => void confirmChanges(post)}
                              disabled={busy}
                            >
                              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                              Send feedback
                            </Button>
                          </div>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------- post preview dialog */}
      <Dialog open={!!previewPost} onOpenChange={(o) => !o && setPreviewPost(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto scrollbar-slim sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-8 leading-snug">{previewPost?.title}</DialogTitle>
            <DialogDescription>
              {previewPost
                ? `by ${previewPost.author.name} · ${BLOG_POST_STATUS_LABELS[previewPost.status]} · updated ${formatDate(previewPost.updatedAt)}`
                : ""}
            </DialogDescription>
            {previewPost && previewPost.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {previewPost.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </DialogHeader>
          {previewPost && (
            <div className="text-sm">
              <ReactMarkdown components={MARKDOWN_COMPONENTS}>{previewPost.content}</ReactMarkdown>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------ approve dialog */}
      <AlertDialog open={!!approvingApp} onOpenChange={(o) => !o && setApprovingApp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {approvingApp?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They can immediately sign in and start drafting. Double-check the writing sample first —
              you can always suspend the account later if quality slips.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmApprove();
              }}
              className="bg-emerald-600 text-white hover:bg-emerald-600/90"
            >
              {busyAppId === approvingApp?.id && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Approve application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------------------------------------------------------- publish dialog */}
      <AlertDialog open={!!publishingPost} onOpenChange={(o) => !o && setPublishingPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish “{publishingPost?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The post goes live on the blog immediately and becomes visible to every visitor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmPublish();
              }}
              className="bg-emerald-600 text-white hover:bg-emerald-600/90"
            >
              {busyPostId === publishingPost?.id && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Publish now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ----------------------------------------------------- unpublish dialog */}
      <AlertDialog open={!!unpublishingPost} onOpenChange={(o) => !o && setUnpublishingPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish “{unpublishingPost?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The post is pulled from the public blog and returns to the editorial queue — existing links
              to it will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmUnpublish();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busyPostId === unpublishingPost?.id && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
