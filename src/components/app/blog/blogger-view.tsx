"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  ExternalLink,
  FileEdit,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  MailCheck,
  Pencil,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Trash2,
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  bloggerLogin,
  bloggerLogout,
  bloggerSignup,
  createBlogPost,
  deleteBlogPost,
  getBloggerSession,
  getMyPosts,
  requestBloggerPasswordReset,
  resetBloggerPassword,
  submitBlogPost,
  updateBlogPost,
} from "@/lib/api";
import {
  BLOG_POST_STATUS_LABELS,
  formatDate,
  type BlogPostDTO,
  type BlogPostInput,
  type BlogPostStatus,
  type BlogPostSummary,
} from "@/lib/types";
import { PASSWORD_RULES, generatePassword, isValidPassword } from "@/lib/password-policy";
import type { AppNavigate, BloggerMode } from "../use-app-route";
import { cn } from "@/lib/utils";

type Phase = "checking" | "guest" | "authed";

interface SessionBlogger {
  id: string;
  name: string;
  email: string;
  status: string;
}

const STATUS_BADGE_STYLES: Record<BlogPostStatus, string> = {
  DRAFT: "border-border text-muted-foreground",
  SUBMITTED: "border-amber-300/60 text-amber-700 dark:border-amber-700/60 dark:text-amber-300",
  PUBLISHED: "border-emerald-300/60 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-300",
  REJECTED: "border-rose-300/60 text-rose-700 dark:border-rose-700/60 dark:text-rose-300",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Blogger studio — three states: session check, guest auth (sign-in,
 * application, forgot/reset password), and the signed-in post manager with a
 * quality-gated editor.
 */
export function BloggerView({
  navigate,
  initialMode,
  resetToken,
}: {
  navigate: AppNavigate;
  initialMode: BloggerMode;
  /** Raw one-time token from the emailed reset link (reset mode only). */
  resetToken?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [me, setMe] = useState<SessionBlogger | null>(null);

  // ------------------------------------------------------------ guest state
  const [tab, setTab] = useState<BloggerMode>(initialMode);
  const [lastMode, setLastMode] = useState(initialMode);
  // Keep the chosen tab in sync when the URL mode param changes (header /
  // footer links) — the "adjust state during render" pattern.
  if (initialMode !== lastMode) {
    setLastMode(initialMode);
    setTab(initialMode);
  }

  // sign-in form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // forgot-password form
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState<{ message: string; resetUrl?: string } | null>(null);

  // reset-password form (token arrives via the emailed link)
  const [resetPw, setResetPw] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetAutoGen, setResetAutoGen] = useState(false);
  const [resetTouched, setResetTouched] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState<string | null>(null);

  // application form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [autoGen, setAutoGen] = useState(false);
  const [bio, setBio] = useState("");
  const [reason, setReason] = useState("");
  const [sample, setSample] = useState("");
  const [applying, setApplying] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // ----------------------------------------------------------- studio state
  const [posts, setPosts] = useState<BlogPostSummary[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPostDTO | null>(null);
  const [submittingPost, setSubmittingPost] = useState<BlogPostSummary | null>(null);
  const [deleting, setDeleting] = useState<BlogPostSummary | null>(null);

  // ------------------------------------------------------------ session flow
  const checkSession = useCallback(async () => {
    try {
      const res = await getBloggerSession();
      if (res.authenticated) {
        setMe({
          id: res.blogger.id,
          name: res.blogger.name,
          email: res.blogger.email,
          status: res.blogger.status,
        });
        setPhase("authed");
      } else {
        setMe(null);
        setPhase("guest");
      }
    } catch {
      setMe(null);
      setPhase("guest");
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  /** Any 401 from a studio call means the session expired — back to guest. */
  const handleAuthExpired = useCallback(() => {
    toast.info("Session expired — please sign in again.");
    setMe(null);
    setPosts(null);
    setPostsError(null);
    setPhase("guest");
  }, []);

  const refreshPosts = useCallback(async () => {
    setPostsError(null);
    try {
      setPosts(await getMyPosts());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        handleAuthExpired();
        return;
      }
      setPosts(null);
      setPostsError(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Couldn't load your posts."
      );
    }
  }, [handleAuthExpired]);

  useEffect(() => {
    if (phase === "authed") void refreshPosts();
  }, [phase, refreshPosts]);

  // ------------------------------------------------------------ guest: login
  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggingIn) return;
    setLoginError(null);
    if (!loginEmail.trim() || !loginPw) {
      setLoginError("Enter your email and password.");
      return;
    }
    setLoggingIn(true);
    try {
      await bloggerLogin(loginEmail.trim(), loginPw);
      toast.success("Signed in — welcome back!");
      await checkSession(); // re-check the session and flip to the studio
    } catch (err) {
      // rate limits, lockouts, "still under review"… all surfaced inline
      setLoginError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't sign in. Please try again."
      );
    } finally {
      setLoggingIn(false);
    }
  };

  // ------------------------------------------------- guest: forgot password
  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotSending) return;
    setForgotError(null);
    if (!EMAIL_RE.test(forgotEmail.trim())) {
      setForgotError("Please enter a valid email address.");
      return;
    }
    setForgotSending(true);
    try {
      const res = await requestBloggerPasswordReset(forgotEmail.trim());
      setForgotSent({ message: res.message, resetUrl: res.dryRun ? res.resetUrl : undefined });
    } catch (err) {
      setForgotError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't send the reset email. Please try again."
      );
    } finally {
      setForgotSending(false);
    }
  };

  // -------------------------------------------------- guest: reset password
  const resetErrors = useMemo(() => {
    const errs: { password?: string; confirm?: string } = {};
    if (!isValidPassword(resetPw)) errs.password = "Choose a password that passes every rule below.";
    if (resetPw !== resetConfirm) errs.confirm = "Passwords don't match";
    return errs;
  }, [resetPw, resetConfirm]);

  const fillResetGenerated = () => {
    const generated = generatePassword();
    setResetPw(generated);
    setResetConfirm(generated);
    setShowResetPw(true);
    setShowResetConfirm(true);
    setResetAutoGen(true);
  };

  const handleResetPwFocus = () => {
    if (resetPw === "" && resetConfirm === "") fillResetGenerated();
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetting) return;
    setResetTouched(true);
    setResetError(null);
    if (Object.keys(resetErrors).length > 0) return;
    if (!resetToken) {
      setResetError("This reset link is incomplete — request a new one.");
      return;
    }
    setResetting(true);
    try {
      const res = await resetBloggerPassword(resetToken, resetPw);
      setResetDone(res.message);
      setResetPw("");
      setResetConfirm("");
    } catch (err) {
      setResetError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't reset the password. Please try again."
      );
    } finally {
      setResetting(false);
    }
  };

  // ----------------------------------------------------------- guest: signup
  const applyErrors = useMemo(() => {
    const errs: Partial<Record<"name" | "email" | "password" | "confirm" | "reason" | "sample", string>> =
      {};
    if (name.trim().length < 2) errs.name = "Please enter your name (at least 2 characters).";
    if (!EMAIL_RE.test(email.trim())) errs.email = "Please enter a valid email address.";
    if (!isValidPassword(pw)) errs.password = "Choose a password that passes every rule below.";
    if (pw !== confirmPw) errs.confirm = "Passwords don't match";
    if (reason.trim().length < 30) errs.reason = "Tell us a bit more — at least 30 characters.";
    if (reason.trim().length > 1000) errs.reason = "Keep it under 1,000 characters.";
    if (sample.trim().length < 200) errs.sample = "Writing sample needs at least 200 characters.";
    if (sample.trim().length > 10000) errs.sample = "Keep the sample under 10,000 characters.";
    return errs;
  }, [name, email, pw, confirmPw, reason, sample]);

  const showConfirmError = (touched || confirmPw.length > 0) && !!applyErrors.confirm;

  /**
   * The core UX trick: focusing the (still empty) password field — by click
   * or Tab — generates a strong password into BOTH fields and reveals it.
   * Never fires when either field has content, so user input is never lost.
   */
  const fillGenerated = () => {
    const generated = generatePassword();
    setPw(generated);
    setConfirmPw(generated);
    setShowPw(true);
    setShowConfirm(true);
    setAutoGen(true);
  };

  const handlePasswordFocus = () => {
    if (pw === "" && confirmPw === "") fillGenerated();
  };

  const submitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (applying) return;
    setTouched(true);
    setSignupError(null);
    if (Object.keys(applyErrors).length > 0) return;
    setApplying(true);
    try {
      const res = await bloggerSignup({
        name: name.trim(),
        email: email.trim(),
        password: pw,
        bio: bio.trim(),
        applicationReason: reason.trim(),
        writingSample: sample.trim(),
      });
      setApplied(res.message);
      toast.success("Application received!");
    } catch (err) {
      setSignupError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't submit the application. Please try again."
      );
    } finally {
      setApplying(false);
    }
  };

  // --------------------------------------------------------------- studio
  const signOut = async () => {
    try {
      await bloggerLogout();
    } catch {
      // logging out is safe even if the request fails
    }
    toast.success("Signed out — see you soon!");
    setMe(null);
    setPosts(null);
    setPostsError(null);
    setPhase("guest");
    setTab("login");
  };

  const openEditor = (post: BlogPostSummary | null) => {
    // The author API returns full post DTOs at runtime (content included); the
    // client types them as summaries, so cast to prefill the editor.
    setEditing(post as BlogPostDTO | null);
    setEditorOpen(true);
  };

  const confirmSubmit = async () => {
    if (!submittingPost) return;
    const post = submittingPost;
    setBusyId(post.id);
    try {
      await submitBlogPost(post.id);
      toast.success("Submitted for review — the editors will take a look.");
      await refreshPosts();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) handleAuthExpired();
      else
        toast.error(
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Couldn't submit the post."
        );
    } finally {
      setBusyId(null);
      setSubmittingPost(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const post = deleting;
    setBusyId(post.id);
    try {
      await deleteBlogPost(post.id);
      toast.success("Post deleted");
      await refreshPosts();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) handleAuthExpired();
      else
        toast.error(
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed."
        );
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  };

  const stats = useMemo(
    () => ({
      drafts: posts?.filter((p) => p.status === "DRAFT").length ?? 0,
      review: posts?.filter((p) => p.status === "SUBMITTED").length ?? 0,
      published: posts?.filter((p) => p.status === "PUBLISHED").length ?? 0,
      changes: posts?.filter((p) => p.status === "REJECTED").length ?? 0,
    }),
    [posts]
  );

  // ---------------------------------------------------------------- render
  if (phase === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Checking your session">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          <p className="text-sm">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (phase === "guest") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground"
            >
              <PenLine className="size-3.5 text-primary" aria-hidden="true" />
              Blogger studio
            </Badge>
            <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Write for the blog
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              Sign in to manage your posts, or apply to blog and share your AI
              workflows with thousands of readers.
            </p>
          </div>

          {tab === "forgot" ? (
            <div className="mt-8">
              <Card className="py-0">
                <CardContent className="p-6">
                  {forgotSent ? (
                    <div className="text-center">
                      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <MailCheck className="size-6" aria-hidden="true" />
                      </span>
                      <h2 className="mt-4 text-xl font-semibold">Check your inbox</h2>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                        {forgotSent.message}
                      </p>
                      {forgotSent.resetUrl && (
                        <div className="mt-4 rounded-lg border border-dashed p-4 text-left">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Demo mode — email delivery isn’t configured
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Use this one-time link to continue (expires in 60 minutes):
                          </p>
                          <a
                            href={forgotSent.resetUrl}
                            className="mt-2 block break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-primary underline underline-offset-4"
                          >
                            {forgotSent.resetUrl}
                          </a>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="mt-5"
                        onClick={() => navigate({ view: "blogger", mode: "login" }, { scroll: true })}
                      >
                        Back to sign in
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-center">
                        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <KeyRound className="size-6" aria-hidden="true" />
                        </span>
                        <h2 className="mt-3 text-xl font-semibold">Forgot your password?</h2>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                          Enter your blogger email and we’ll send a one-time reset link. It
                          expires in 60 minutes.
                        </p>
                      </div>
                      {forgotError && (
                        <Alert variant="destructive" className="mt-4">
                          <AlertTriangle className="size-4" aria-hidden="true" />
                          <AlertTitle>Couldn’t send the email</AlertTitle>
                          <AlertDescription>{forgotError}</AlertDescription>
                        </Alert>
                      )}
                      <form onSubmit={submitForgot} className="mt-4 space-y-4" noValidate>
                        <div className="space-y-2">
                          <Label htmlFor="forgot-email">Email</Label>
                          <Input
                            id="forgot-email"
                            type="email"
                            autoComplete="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="you@example.com"
                            aria-invalid={!!forgotError}
                            autoFocus
                          />
                        </div>
                        <Button type="submit" disabled={forgotSending} className="w-full">
                          {forgotSending ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Send className="size-4" aria-hidden="true" />
                          )}
                          {forgotSending ? "Sending…" : "Send reset link"}
                        </Button>
                      </form>
                      <button
                        type="button"
                        onClick={() => navigate({ view: "blogger", mode: "login" }, { scroll: true })}
                        className="mt-4 rounded-md text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        ← Back to sign in
                      </button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : tab === "reset" ? (
            <div className="mt-8">
              <Card className="py-0">
                <CardContent className="p-6">
                  {resetDone ? (
                    <div className="text-center">
                      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-6" aria-hidden="true" />
                      </span>
                      <h2 className="mt-4 text-xl font-semibold">Password updated</h2>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                        {resetDone}
                      </p>
                      <Button
                        className="mt-5"
                        onClick={() => navigate({ view: "blogger", mode: "login" }, { scroll: true })}
                      >
                        <PenLine className="size-4" aria-hidden="true" />
                        Sign in now
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-center">
                        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <KeyRound className="size-6" aria-hidden="true" />
                        </span>
                        <h2 className="mt-3 text-xl font-semibold">Choose a new password</h2>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                          This link works once — pick a strong password for your blogger account.
                        </p>
                      </div>
                      {resetError && (
                        <Alert variant="destructive" className="mt-4">
                          <AlertTriangle className="size-4" aria-hidden="true" />
                          <AlertTitle>Couldn’t reset the password</AlertTitle>
                          <AlertDescription>{resetError}</AlertDescription>
                        </Alert>
                      )}
                      {!resetToken && (
                        <Alert variant="destructive" className="mt-4">
                          <AlertTriangle className="size-4" aria-hidden="true" />
                          <AlertTitle>Reset link incomplete</AlertTitle>
                          <AlertDescription>
                            The token is missing from this link. Request a new reset email.
                          </AlertDescription>
                        </Alert>
                      )}
                      <form onSubmit={submitReset} className="mt-4 space-y-4" noValidate>
                        <div className="space-y-2">
                          <Label htmlFor="reset-password">New password</Label>
                          <div className="relative">
                            <Input
                              id="reset-password"
                              type={showResetPw ? "text" : "password"}
                              autoComplete="new-password"
                              value={resetPw}
                              onChange={(e) => {
                                setResetPw(e.target.value);
                                setResetAutoGen(false);
                              }}
                              onFocus={handleResetPwFocus}
                              className="pr-[84px]"
                              placeholder="Focus here — we’ll generate a strong one"
                              aria-invalid={resetTouched && !!resetErrors.password}
                              aria-describedby={
                                resetTouched && resetErrors.password ? "reset-password-error" : undefined
                              }
                            />
                            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
                              <button
                                type="button"
                                onClick={fillResetGenerated}
                                aria-label="Regenerate a strong password"
                                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <RefreshCw className="size-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowResetPw((v) => !v)}
                                aria-label={showResetPw ? "Hide password" : "Show password"}
                                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {showResetPw ? (
                                  <EyeOff className="size-4" aria-hidden="true" />
                                ) : (
                                  <Eye className="size-4" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          </div>
                          {resetAutoGen && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              Strong password auto-generated — keep it or edit it.
                            </p>
                          )}
                          {resetTouched && resetErrors.password && (
                            <p id="reset-password-error" className="text-xs text-destructive">
                              {resetErrors.password}
                            </p>
                          )}
                          <ul className="space-y-1.5 pt-1" aria-label="Password requirements">
                            {PASSWORD_RULES.map((r) => (
                              <RuleRow key={r.key} ok={r.test(resetPw)} label={r.label} />
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reset-confirm">Confirm new password</Label>
                          <div className="relative">
                            <Input
                              id="reset-confirm"
                              type={showResetConfirm ? "text" : "password"}
                              autoComplete="new-password"
                              value={resetConfirm}
                              onChange={(e) => setResetConfirm(e.target.value)}
                              className="pr-12"
                              placeholder="Repeat your new password"
                              aria-invalid={
                                (resetTouched || resetConfirm.length > 0) && !!resetErrors.confirm
                              }
                            />
                            <button
                              type="button"
                              onClick={() => setShowResetConfirm((v) => !v)}
                              aria-label={showResetConfirm ? "Hide confirmed password" : "Show confirmed password"}
                              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {showResetConfirm ? (
                                <EyeOff className="size-4" aria-hidden="true" />
                              ) : (
                                <Eye className="size-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                          {(resetTouched || resetConfirm.length > 0) && resetErrors.confirm && (
                            <p className="text-xs text-destructive">Passwords don’t match</p>
                          )}
                        </div>
                        <Button type="submit" disabled={resetting} className="w-full">
                          {resetting ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <KeyRound className="size-4" aria-hidden="true" />
                          )}
                          {resetting ? "Updating…" : "Update password"}
                        </Button>
                      </form>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v === "signup" ? "signup" : "login")} className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Apply to blog</TabsTrigger>
            </TabsList>

            {/* ----------------------------------------------------- sign in */}
            <TabsContent value="login" className="mt-4">
              <Card className="py-0">
                <CardContent className="p-6">
                  {loginError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      <AlertTitle>Couldn’t sign in</AlertTitle>
                      <AlertDescription>{loginError}</AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={submitLogin} className="space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showLoginPw ? "text" : "password"}
                          autoComplete="current-password"
                          value={loginPw}
                          onChange={(e) => setLoginPw(e.target.value)}
                          className="pr-12"
                          placeholder="Your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPw((v) => !v)}
                          aria-label={showLoginPw ? "Hide password" : "Show password"}
                          className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showLoginPw ? (
                            <EyeOff className="size-4" aria-hidden="true" />
                          ) : (
                            <Eye className="size-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" disabled={loggingIn} className="w-full">
                      {loggingIn ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <PenLine className="size-4" aria-hidden="true" />
                      )}
                      {loggingIn ? "Signing in…" : "Sign in"}
                    </Button>
                  </form>
                  <div className="mt-4 flex flex-col gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setTab("signup")}
                      className="rounded-md text-left font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      No account? Apply to blog →
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate({ view: "blogger", mode: "forgot" }, { scroll: true })}
                      className="rounded-md text-left text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </CardContent>
              </Card>
              <Alert className="mt-4">
                <Info className="size-4" aria-hidden="true" />
                <AlertTitle>How it works</AlertTitle>
                <AlertDescription>
                  Apply to blog → the editors review your application within 48
                  hours → write drafts in the studio → every post passes an
                  editorial quality check before it goes live.
                </AlertDescription>
              </Alert>
            </TabsContent>

            {/* ------------------------------------------------ apply to blog */}
            <TabsContent value="signup" className="mt-4">
              {applied ? (
                <div className="rounded-xl border p-8 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-6" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-xl font-semibold">Application received!</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {applied}
                  </p>
                  <Button onClick={() => navigate({ view: "blog" }, { scroll: true })} className="mt-5">
                    Back to blog
                  </Button>
                </div>
              ) : (
                <>
                  <Card className="py-0">
                    <CardContent className="p-6">
                      {signupError && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertTriangle className="size-4" aria-hidden="true" />
                          <AlertTitle>Couldn’t submit your application</AlertTitle>
                          <AlertDescription>{signupError}</AlertDescription>
                        </Alert>
                      )}
                      <form onSubmit={submitApply} className="space-y-5" noValidate>
                        <div className="space-y-2">
                          <Label htmlFor="apply-name">Name</Label>
                          <Input
                            id="apply-name"
                            autoComplete="name"
                            maxLength={80}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your byline name"
                            aria-invalid={touched && !!applyErrors.name}
                            aria-describedby={touched && applyErrors.name ? "apply-name-error" : undefined}
                          />
                          {touched && applyErrors.name && (
                            <p id="apply-name-error" className="text-xs text-destructive">
                              {applyErrors.name}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="apply-email">Email</Label>
                          <Input
                            id="apply-email"
                            type="email"
                            autoComplete="email"
                            maxLength={120}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            aria-invalid={touched && !!applyErrors.email}
                            aria-describedby={touched && applyErrors.email ? "apply-email-error" : undefined}
                          />
                          {touched && applyErrors.email && (
                            <p id="apply-email-error" className="text-xs text-destructive">
                              {applyErrors.email}
                            </p>
                          )}
                        </div>

                        {/* password — auto-generates on first focus */}
                        <div className="space-y-2">
                          <Label htmlFor="apply-password">Password</Label>
                          <div className="relative">
                            <Input
                              id="apply-password"
                              type={showPw ? "text" : "password"}
                              autoComplete="new-password"
                              value={pw}
                              onChange={(e) => {
                                setPw(e.target.value);
                                setAutoGen(false);
                              }}
                              onFocus={handlePasswordFocus}
                              className="pr-[84px]"
                              placeholder="Focus here — we’ll generate a strong one"
                              aria-invalid={touched && !!applyErrors.password}
                              aria-describedby={
                                touched && applyErrors.password ? "apply-password-error" : undefined
                              }
                            />
                            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
                              <button
                                type="button"
                                onClick={fillGenerated}
                                aria-label="Regenerate a strong password"
                                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <RefreshCw className="size-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowPw((v) => !v)}
                                aria-label={showPw ? "Hide password" : "Show password"}
                                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {showPw ? (
                                  <EyeOff className="size-4" aria-hidden="true" />
                                ) : (
                                  <Eye className="size-4" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          </div>
                          {autoGen && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              Strong password auto-generated — keep it or edit it.
                            </p>
                          )}
                          {touched && applyErrors.password && (
                            <p id="apply-password-error" className="text-xs text-destructive">
                              {applyErrors.password}
                            </p>
                          )}
                          <ul className="space-y-1.5 pt-1" aria-label="Password requirements">
                            {PASSWORD_RULES.map((r) => (
                              <RuleRow key={r.key} ok={r.test(pw)} label={r.label} />
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="apply-confirm">Confirm password</Label>
                          <div className="relative">
                            <Input
                              id="apply-confirm"
                              type={showConfirm ? "text" : "password"}
                              autoComplete="new-password"
                              value={confirmPw}
                              onChange={(e) => setConfirmPw(e.target.value)}
                              className="pr-12"
                              placeholder="Repeat your password"
                              aria-invalid={showConfirmError}
                              aria-describedby={showConfirmError ? "apply-confirm-error" : undefined}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm((v) => !v)}
                              aria-label={showConfirm ? "Hide confirmed password" : "Show confirmed password"}
                              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {showConfirm ? (
                                <EyeOff className="size-4" aria-hidden="true" />
                              ) : (
                                <Eye className="size-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                          {showConfirmError && (
                            <p id="apply-confirm-error" className="text-xs text-destructive">
                              Passwords don't match
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <Label htmlFor="apply-bio">Bio (optional)</Label>
                            <span className="text-xs text-muted-foreground">Shown on your articles</span>
                          </div>
                          <Textarea
                            id="apply-bio"
                            rows={3}
                            maxLength={300}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="A line or two about you — appears under your byline."
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <Label htmlFor="apply-reason">Why do you want to write here?</Label>
                            <span
                              className={cn(
                                "text-xs",
                                reason.length > 1000 ? "text-destructive" : "text-muted-foreground"
                              )}
                            >
                              {reason.length.toLocaleString()} / 1,000
                            </span>
                          </div>
                          <Textarea
                            id="apply-reason"
                            rows={4}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="What will you bring to the blog?"
                            aria-invalid={touched && !!applyErrors.reason}
                            aria-describedby={touched && applyErrors.reason ? "apply-reason-error" : undefined}
                          />
                          {touched && applyErrors.reason && (
                            <p id="apply-reason-error" className="text-xs text-destructive">
                              {applyErrors.reason}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <Label htmlFor="apply-sample">Writing sample</Label>
                            <span
                              className={cn(
                                "text-xs",
                                sample.length > 10000 ? "text-destructive" : "text-muted-foreground"
                              )}
                            >
                              {sample.length.toLocaleString()} / 10,000
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Paste 1–3 paragraphs you're proud of.
                          </p>
                          <Textarea
                            id="apply-sample"
                            rows={6}
                            value={sample}
                            onChange={(e) => setSample(e.target.value)}
                            placeholder="Show us your voice — anything you'd be happy to publish."
                            aria-invalid={touched && !!applyErrors.sample}
                            aria-describedby={touched && applyErrors.sample ? "apply-sample-error" : undefined}
                          />
                          {touched && applyErrors.sample && (
                            <p id="apply-sample-error" className="text-xs text-destructive">
                              {applyErrors.sample}
                            </p>
                          )}
                        </div>

                        <Button type="submit" disabled={applying} className="w-full">
                          {applying ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Send className="size-4" aria-hidden="true" />
                          )}
                          {applying ? "Sending application…" : "Submit application"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                  <Alert className="mt-4">
                    <Info className="size-4" aria-hidden="true" />
                    <AlertTitle>Before you apply</AlertTitle>
                    <AlertDescription>
                      Blogger accounts require a 20+ character password.
                      Applications are reviewed by the editors within 48 hours.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </TabsContent>
          </Tabs>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- authed
  const blogger = me; // non-null when phase === "authed"
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back, {blogger?.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{blogger?.email}</p>
        </div>
        <Button variant="outline" onClick={() => void signOut()} className="shrink-0">
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </Button>
      </header>

      {/* ------------------------------------------------------------ stats */}
      <section aria-label="Your posting stats" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={FileEdit}
          tone="bg-muted text-muted-foreground"
          value={stats.drafts}
          label="Drafts"
        />
        <StatCard
          icon={Clock}
          tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          value={stats.review}
          label="In review"
        />
        <StatCard
          icon={CheckCircle2}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          value={stats.published}
          label="Published"
        />
        <StatCard
          icon={AlertCircle}
          tone="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          value={stats.changes}
          label="Changes requested"
        />
      </section>

      {/* --------------------------------------------------------- my posts */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">My posts</h2>
        <Button onClick={() => openEditor(null)}>
          <Plus className="size-4" aria-hidden="true" />
          New post
        </Button>
      </div>

      {posts === null && !postsError ? (
        <div className="mt-4 space-y-3" role="status" aria-label="Loading your posts">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
          ))}
        </div>
      ) : postsError ? (
        <div className="mt-4 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">{postsError}</p>
          <Button variant="outline" onClick={() => void refreshPosts()} className="mt-3">
            Try again
          </Button>
        </div>
      ) : posts && posts.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed p-10 text-center">
          <PenLine className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-medium">No posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a draft — it stays private until you submit it for review.
          </p>
          <Button onClick={() => openEditor(null)} className="mt-4">
            <Plus className="size-4" aria-hidden="true" />
            Write your first post
          </Button>
        </div>
      ) : (
        <ul className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1 scrollbar-slim" aria-live="polite" aria-label="Your posts">
          {posts?.map((p) => (
            <li key={p.id}>
              <Card
                className={cn(
                  "py-0 transition-opacity",
                  busyId === p.id && "pointer-events-none opacity-60"
                )}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold leading-tight">{p.title}</h3>
                        <Badge
                          variant="outline"
                          className={cn("font-normal", STATUS_BADGE_STYLES[p.status])}
                        >
                          {BLOG_POST_STATUS_LABELS[p.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated {formatDate(p.updatedAt)}
                      </p>
                      {p.status === "REJECTED" && p.reviewNote && (
                        <Alert className="mt-3 border-amber-300/60 bg-amber-50/60 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
                          <AlertTriangle
                            className="size-4 text-amber-600 dark:text-amber-400"
                            aria-hidden="true"
                          />
                          <AlertTitle>Editor feedback</AlertTitle>
                          <AlertDescription className="text-amber-800/90 dark:text-amber-300/90">
                            {p.reviewNote}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {busyId === p.id && (
                        <Loader2
                          className="size-4 animate-spin text-muted-foreground"
                          aria-label="Working…"
                        />
                      )}
                      {p.status === "PUBLISHED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() =>
                            navigate({ view: "blogpost", postSlug: p.slug }, { scroll: true })
                          }
                        >
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                          View live
                        </Button>
                      )}
                      {(p.status === "DRAFT" || p.status === "REJECTED") && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9"
                            onClick={() => openEditor(p)}
                            aria-label={`Edit ${p.title}`}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9"
                            onClick={() => setSubmittingPost(p)}
                            aria-label={`Submit ${p.title} for review`}
                          >
                            <Send className="size-3.5" aria-hidden="true" />
                            Submit for review
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 text-destructive hover:text-destructive"
                            onClick={() => setDeleting(p)}
                            aria-label={`Delete ${p.title}`}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------------------------------------- editor */}
      <PostEditorDialog
        open={editorOpen}
        editing={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void refreshPosts()}
        onAuthExpired={handleAuthExpired}
      />

      {/* ---------------------------------------------- submit confirm */}
      <AlertDialog open={!!submittingPost} onOpenChange={(o) => !o && setSubmittingPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit “{submittingPost?.title}” for review?</AlertDialogTitle>
            <AlertDialogDescription>
              The editors will review it within 48 hours. You won't be able to
              edit it while it's in review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmSubmit();
              }}
            >
              Submit for review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------------------------------------------------ delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” — this permanently deletes the draft and cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ------------------------------------------------------------------ helpers

/** One row of a live checklist — emerald check when passing, muted X when not. */
function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <X className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className={cn("text-sm", ok ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </li>
  );
}

function StatCard({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <span
          aria-hidden="true"
          className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-none">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Create/edit post dialog with the editorial quality gates. "Save draft"
 * needs a title (≥ 4 chars); "Submit for review" needs every gate and
 * saves first, then pushes the post into the review queue.
 */
function PostEditorDialog({
  open,
  editing,
  onClose,
  onSaved,
  onAuthExpired,
}: {
  open: boolean;
  editing: BlogPostDTO | null;
  onClose: () => void;
  onSaved: () => void;
  onAuthExpired: () => void;
}) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Opening resets the form (prefilled when editing an existing post).
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setExcerpt(editing?.excerpt ?? "");
    setTagsRaw(editing?.tags.join(", ") ?? "");
    setContent(editing?.content ?? "");
    setSaving(false);
  }, [open, editing]);

  const parsedTags = useMemo(
    () =>
      tagsRaw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 2)
        .slice(0, 5),
    [tagsRaw]
  );

  const titleGate = title.trim().length >= 10;
  const excerptGate = excerpt.trim().length >= 20;
  const contentGate = content.trim().length >= 400;
  const allGates = titleGate && excerptGate && contentGate;

  const input = (): BlogPostInput => ({
    title: title.trim(),
    excerpt: excerpt.trim(),
    content,
    tags: parsedTags,
  });

  const fail = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.status === 401) {
      onAuthExpired();
      onClose();
      return;
    }
    toast.error(e instanceof Error ? e.message : fallback);
  };

  const saveDraft = async () => {
    if (saving || title.trim().length < 4) return;
    setSaving(true);
    try {
      if (editing) await updateBlogPost(editing.id, input());
      else await createBlogPost(input());
      toast.success("Draft saved");
      onSaved();
      onClose();
    } catch (e) {
      fail(e, "Couldn't save the draft.");
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    if (saving || !allGates) return;
    setSaving(true);
    try {
      // save first (create or update), then push it into the review queue
      const saved = editing
        ? await updateBlogPost(editing.id, input())
        : await createBlogPost(input());
      await submitBlogPost(saved.id);
      toast.success("Submitted for review — the editors will take a look.");
      onSaved();
      onClose();
    } catch (e) {
      fail(e, "Couldn't submit the post.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit post" : "New post"}</DialogTitle>
          <DialogDescription>
            Markdown is supported. Drafts stay private to you until an editor
            publishes them.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1 scrollbar-slim">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="editor-title">Title</Label>
              <span className="text-xs text-muted-foreground">{title.length}/120</span>
            </div>
            <Input
              id="editor-title"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How I plan a week with an AI assistant"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="editor-excerpt">Excerpt</Label>
              <span className="text-xs text-muted-foreground">{excerpt.length}/200</span>
            </div>
            <Input
              id="editor-excerpt"
              maxLength={200}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="One or two sentences that make readers click."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="editor-tags">Tags</Label>
              <span className="text-xs text-muted-foreground">
                Comma-separated · up to 5 · {parsedTags.length}/5 used
              </span>
            </div>
            <Input
              id="editor-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="prompting, productivity, review"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="editor-content">Content (Markdown)</Label>
              <span className="text-xs text-muted-foreground">
                {content.length.toLocaleString()} characters
              </span>
            </div>
            <Textarea
              id="editor-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"## Intro\n\nWrite your guide here…"}
              className="min-h-[280px] font-mono text-sm"
            />
            <ul
              className="space-y-1.5 rounded-lg border bg-muted/30 p-3"
              aria-label="Submission quality gates"
            >
              <RuleRow ok={titleGate} label="Title is at least 10 characters" />
              <RuleRow ok={excerptGate} label="Excerpt is at least 20 characters" />
              <RuleRow ok={contentGate} label="Content is at least 400 characters" />
            </ul>
          </div>
        </div>

        <DialogFooter className="mt-0">
          <Button variant="outline" onClick={() => void saveDraft()} disabled={saving || title.trim().length < 4}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Save draft
          </Button>
          <Button onClick={() => void submitForReview()} disabled={saving || !allGates}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            Submit for review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
