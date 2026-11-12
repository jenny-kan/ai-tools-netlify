"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  Loader2,
  Mail,
  MessageSquareHeart,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, getContactChallenge, submitContactMessage } from "@/lib/api";
import { CONTACT_REASON_LABELS, type ContactReason } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { AppNavigate } from "./use-app-route";
import { useDocumentTitle } from "@/hooks/use-document-title";

const REASONS = Object.keys(CONTACT_REASON_LABELS) as ContactReason[];

const REASON_ICONS: Record<ContactReason, React.ReactNode> = {
  FEEDBACK: <MessageSquareHeart className="size-4" />,
  ISSUE: <Bug className="size-4" />,
  SUGGESTION: <Lightbulb className="size-4" />,
  TOOL_SUGGESTION: <Sparkles className="size-4" />,
  OTHER: <Mail className="size-4" />,
};

const REASON_HINTS: Record<ContactReason, string> = {
  FEEDBACK: "Tell us what works, what doesn't, and what you'd change.",
  ISSUE: "Found a broken link, wrong pricing, or a bug? Let us know what happened.",
  SUGGESTION: "Ideas to make this directory more useful for you.",
  TOOL_SUGGESTION: "Know a great AI tool we're missing — especially free ones? Share it and we'll review it.",
  OTHER: "Anything that doesn't fit the categories above.",
};

type FieldErrors = Partial<Record<"name" | "email" | "subject" | "message" | "toolName" | "toolUrl" | "challenge" | "reason", string>>;

/**
 * Public contact page — reachable at ?view=contact.
 * Spam protection: hidden honeypot field, minimum fill time, and a
 * server-verified math challenge. See /api/contact for the server layers.
 */
export function ContactView({ navigate }: { navigate: AppNavigate }) {
  useDocumentTitle("Contact & feedback");
  /** When the page loaded — used server-side as a bot-timing check. */
  const loadedAt = useRef(Date.now());

  const [reason, setReason] = useState<ContactReason>("FEEDBACK");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [toolName, setToolName] = useState("");
  const [toolUrl, setToolUrl] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bots only

  const [challenge, setChallenge] = useState<{ question: string; token: string } | null>(null);
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(true);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const loadChallenge = useCallback(async () => {
    setChallengeLoading(true);
    setChallengeAnswer("");
    try {
      setChallenge(await getContactChallenge());
    } catch {
      toast.error("Couldn't load the security question. Please try again.");
    } finally {
      setChallengeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  const setFieldError = (field: keyof FieldErrors, error?: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (name.trim().length < 2 || name.trim().length > 80)
      next.name = "Please enter your name (2–80 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      next.email = "Please enter a valid email address so we can reply.";
    if (subject.trim().length < 3 || subject.trim().length > 120)
      next.subject = "Subject must be 3–120 characters.";
    if (message.trim().length < 20 || message.trim().length > 4000)
      next.message = "Message must be 20–4000 characters.";
    if (reason === "TOOL_SUGGESTION" && (toolName.trim().length < 2 || toolName.trim().length > 80))
      next.toolName = "Please tell us the tool's name (2–80 characters).";
    if (toolUrl.trim() && !/^https?:\/\//i.test(toolUrl.trim()))
      next.toolUrl = "URL must start with http:// or https://.";
    if (!challenge || !challengeAnswer.trim())
      next.challenge = "Please answer the security question.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      await submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        reason,
        subject: subject.trim(),
        message: message.trim(),
        toolName: toolName.trim(),
        toolUrl: toolUrl.trim(),
        website: honeypot,
        loadedAt: loadedAt.current,
        challengeToken: challenge?.token ?? "",
        challengeAnswer: challengeAnswer.trim(),
      });
      setSent(true);
      toast.success("Message sent — thank you!");
    } catch (err) {
      if (err instanceof ApiError) {
        const field = typeof err.body.field === "string" ? (err.body.field as keyof FieldErrors) : undefined;
        if (field) setFieldError(field, err.message);
        toast.error(err.message);
        if (field === "challenge") void loadChallenge();
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => navigate({ view: "home" }, { scroll: true })}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to all tools
      </Button>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* ------------------------------------------------------------ form */}
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Get in touch</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Feedback, a broken link, an idea — or a great AI tool we're missing (especially free
            ones)? Send it straight to the editor's inbox. Your email is only used to reply to you.
          </p>

          {sent ? (
            <Card className="mt-6 border-primary/30">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="size-7" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold">Message sent</h2>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  Thank you, {name.trim().split(/\s+/)[0] || "friend"} — your message is in the
                  admin inbox and will be reviewed shortly. If you asked for a reply, you'll hear
                  back at <span className="font-medium text-foreground">{email.trim()}</span>.
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => navigate({ view: "home" }, { scroll: true })}>
                    Browse tools
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSent(false);
                      setSubject("");
                      setMessage("");
                      setToolName("");
                      setToolUrl("");
                      setChallengeAnswer("");
                      void loadChallenge();
                    }}
                  >
                    Send another message
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Send a message</CardTitle>
                <CardDescription>
                  All fields are checked for spam before anything reaches the inbox.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-5" noValidate>
                  {/* reason picker */}
                  <fieldset>
                    <legend className="text-sm font-medium">What is this about?</legend>
                    <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Reason for contact">
                      {REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          role="radio"
                          aria-checked={reason === r}
                          onClick={() => {
                            setReason(r);
                            setFieldError("reason");
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            reason === r
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          )}
                        >
                          {REASON_ICONS[r]}
                          {CONTACT_REASON_LABELS[r]}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{REASON_HINTS[reason]}</p>
                  </fieldset>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Your name</Label>
                      <Input
                        id="contact-name"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setFieldError("name"); }}
                        placeholder="Jane Doe"
                        maxLength={80}
                        autoComplete="name"
                        aria-invalid={!!errors.name}
                      />
                      {errors.name && <p className="text-xs text-destructive" role="alert">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">Email</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setFieldError("email"); }}
                        placeholder="jane@example.com"
                        maxLength={120}
                        autoComplete="email"
                        aria-invalid={!!errors.email}
                      />
                      {errors.email && <p className="text-xs text-destructive" role="alert">{errors.email}</p>}
                    </div>
                  </div>

                  {/* tool suggestion extras */}
                  {reason === "TOOL_SUGGESTION" && (
                    <div className="grid gap-4 rounded-xl border border-dashed bg-muted/30 p-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="contact-tool-name">Tool name</Label>
                        <Input
                          id="contact-tool-name"
                          value={toolName}
                          onChange={(e) => { setToolName(e.target.value); setFieldError("toolName"); }}
                          placeholder="e.g. Suno"
                          maxLength={80}
                          aria-invalid={!!errors.toolName}
                        />
                        {errors.toolName && <p className="text-xs text-destructive" role="alert">{errors.toolName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact-tool-url">
                          Official URL <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="contact-tool-url"
                          type="url"
                          inputMode="url"
                          value={toolUrl}
                          onChange={(e) => { setToolUrl(e.target.value); setFieldError("toolUrl"); }}
                          placeholder="https://suno.com"
                          maxLength={300}
                          aria-invalid={!!errors.toolUrl}
                        />
                        {errors.toolUrl && <p className="text-xs text-destructive" role="alert">{errors.toolUrl}</p>}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                        Include the free-plan details if you know them — it speeds up review.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="contact-subject">Subject</Label>
                    <Input
                      id="contact-subject"
                      value={subject}
                      onChange={(e) => { setSubject(e.target.value); setFieldError("subject"); }}
                      placeholder={
                        reason === "TOOL_SUGGESTION"
                          ? "Suggested tool: free AI podcast editor"
                          : "A short summary of your message"
                      }
                      maxLength={120}
                      aria-invalid={!!errors.subject}
                    />
                    {errors.subject && <p className="text-xs text-destructive" role="alert">{errors.subject}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-message">Message</Label>
                    <Textarea
                      id="contact-message"
                      value={message}
                      onChange={(e) => { setMessage(e.target.value); setFieldError("message"); }}
                      placeholder="Tell us what's on your mind — the more specific, the better we can help."
                      rows={6}
                      maxLength={4000}
                      aria-invalid={!!errors.message}
                      aria-describedby="contact-message-hint"
                    />
                    <div className="flex items-center justify-between">
                      {errors.message ? (
                        <p className="text-xs text-destructive" role="alert">{errors.message}</p>
                      ) : (
                        <p id="contact-message-hint" className="text-xs text-muted-foreground">
                          20–4000 characters.
                        </p>
                      )}
                      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                        {message.length}/4000
                      </span>
                    </div>
                  </div>

                  {/* math challenge */}
                  <div className="space-y-2">
                    <Label htmlFor="contact-challenge" className="flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                      Security check
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium tabular-nums">
                        {challengeLoading ? "Loading…" : challenge?.question}
                      </span>
                      <Input
                        id="contact-challenge"
                        value={challengeAnswer}
                        onChange={(e) => {
                          setChallengeAnswer(e.target.value);
                          setFieldError("challenge");
                        }}
                        placeholder="Answer"
                        inputMode="numeric"
                        autoComplete="off"
                        className="w-24"
                        aria-invalid={!!errors.challenge}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void loadChallenge()}
                        aria-label="Get a new question"
                        disabled={challengeLoading}
                      >
                        {challengeLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </Button>
                    </div>
                    {errors.challenge && <p className="text-xs text-destructive" role="alert">{errors.challenge}</p>}
                  </div>

                  {/* honeypot — visually hidden, ignored by humans & screen readers */}
                  <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                    <label htmlFor="contact-website">Leave this field empty</label>
                    <input
                      id="contact-website"
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full font-semibold sm:w-auto" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="size-4" aria-hidden="true" />
                    )}
                    Send message
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* --------------------------------------------------------- sidebar */}
        <aside className="space-y-4 lg:pt-[4.7rem]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                How your message is protected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  ["Spam filtering", "Every submission passes a bot check, a hidden spam trap, and rate limits before it reaches the inbox."],
                  ["Signed challenge", "The security question is generated and verified on the server — it can't be faked or replayed."],
                  ["Minimal data", "We store your name, email, and message — nothing else. The email is used only to reply to you."],
                  ["No newsletters", "Your address is never added to any list and messages can be deleted on request."],
                ].map(([title, text]) => (
                  <li key={title} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <span className="font-medium text-foreground">{title}.</span> {text}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="size-4 text-primary" aria-hidden="true" />
                Before reporting an issue
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Pricing changes fast in AI. Each listing shows a{" "}
                <span className="font-medium text-foreground">“pricing checked”</span> date — if a
                price looks outdated, that's the most common culprit, and telling us helps everyone.
                For broken links, include the tool's name and what went wrong.
              </p>
              <Badge variant="outline" className="mt-3 font-normal text-muted-foreground">
                Typical reply time: a few days
              </Badge>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
