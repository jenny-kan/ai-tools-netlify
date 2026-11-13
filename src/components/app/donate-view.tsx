"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  Heart,
  Loader2,
  Lock,
  Megaphone,
  PartyPopper,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDonation, confirmDonation, ApiError } from "@/lib/api";
import type { DonationDTO } from "@/lib/types";
import type { AppNavigate } from "./use-app-route";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { AdSlot } from "./ad-slot";
import { cn } from "@/lib/utils";

const PRESETS = [500, 1000, 2500, 5000]; // cents

const WHY = [
  { icon: BadgeCheck, title: "Hand-checked listings", text: "Every tool's pricing and free-plan limits are verified by an editor, not scraped." },
  { icon: ShieldCheck, title: "No pay-to-rank", text: "Tools are never charged for placement — donations keep the rankings honest." },
  { icon: Heart, title: "Free forever", text: "The directory stays free for everyone. Readers' support pays the bills." },
];

export function DonateView({ navigate }: { navigate: AppNavigate }) {
  useDocumentTitle("Support ai tools central — donate");
  const [donorName, setDonorName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [amountCents, setAmountCents] = useState(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [donation, setDonation] = useState<DonationDTO | null>(null);
  const [confirming, setConfirming] = useState(false);

  const effectiveCents = useMemo(() => {
    if (customAmount.trim() !== "") {
      const dollars = Number(customAmount.replace(/[^0-9.]/g, ""));
      return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
    }
    return amountCents;
  }, [customAmount, amountCents]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (donorName.trim().length < 2) {
      setError("Please enter a name we can thank.");
      return;
    }
    if (!Number.isInteger(effectiveCents) || effectiveCents < 100 || effectiveCents > 1_000_000) {
      setError("Choose an amount between $1 and $10,000.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createDonation({
        donorName: donorName.trim(),
        email: email.trim(),
        amountCents: effectiveCents,
        message: message.trim(),
      });
      setDonation(created);
      toast.success("Donation started — thank you!");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const simulatePayment = async () => {
    if (!donation || confirming) return;
    setConfirming(true);
    try {
      const done = await confirmDonation(donation.id);
      setDonation(done);
      toast.success("Donation completed — you're officially awesome ❤");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete the donation.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      {/* ------------------------------------------------------------- hero */}
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground">
          <Heart className="size-3.5 text-rose-500" aria-hidden="true" />
          Support independent curation
        </Badge>
        <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Keep ai tools central free &amp; independent
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          No ads in your face, no pay-to-rank listings. Donations from readers like you keep the catalog
          hand-checked and free for everyone.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {WHY.map((w) => (
          <Card key={w.title} className="py-5">
            <CardContent className="px-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                <w.icon className="size-4.5 size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-3 font-semibold leading-tight">{w.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{w.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.2fr_1fr]">
        {/* ------------------------------------------------------ donate card */}
        <Card>
          <CardHeader>
            <CardTitle>Make a donation</CardTitle>
            <CardDescription>
              Demo checkout — no real payment is processed. Production deployments wire this to
              PayPal, Stripe or Ko-fi via environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {donation ? (
              <div className="space-y-4 text-center" role="status">
                {donation.status === "COMPLETED" ? (
                  <>
                    <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <PartyPopper className="size-7" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-semibold">
                      Thank you, {donation.donorName}! 🎉
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Your ${(donation.amountCents / 100).toFixed(2)} donation is confirmed. A receipt
                      {donation.email ? ` is on its way to ${donation.email}` : " is available from your payment provider"}.
                    </p>
                    <Button variant="outline" onClick={() => { setDonation(null); setMessage(""); setCustomAmount(""); }}>
                      Donate again
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Lock className="size-7" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-semibold">
                      Confirm your ${(donation.amountCents / 100).toFixed(2)} donation
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      In demo mode, clicking below simulates a successful payment. In production this
                      button is replaced by the payment provider&apos;s checkout.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => void simulatePayment()} disabled={confirming}>
                        {confirming && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                        Complete payment (demo)
                      </Button>
                      <Button variant="ghost" onClick={() => setDonation(null)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Choose an amount (USD)</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PRESETS.map((cents) => (
                      <button
                        key={cents}
                        type="button"
                        aria-pressed={customAmount.trim() === "" && amountCents === cents}
                        onClick={() => { setAmountCents(cents); setCustomAmount(""); }}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          customAmount.trim() === "" && amountCents === cents
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        ${(cents / 100).toFixed(0)}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="Custom amount"
                      aria-label="Custom donation amount in dollars"
                      className="pl-7"
                    />
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="donor-name">Name</Label>
                    <Input
                      id="donor-name"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      placeholder="Ada Lovelace"
                      maxLength={80}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="donor-email">Email (optional)</Label>
                    <Input
                      id="donor-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      maxLength={120}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="donor-message">Message (optional)</Label>
                  <Textarea
                    id="donor-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Say something nice — we read every one."
                    rows={3}
                    maxLength={500}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" className="w-full font-semibold" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Heart className="size-4" aria-hidden="true" />
                  )}
                  Donate {effectiveCents >= 100 ? `$${(effectiveCents / 100).toFixed(2)}` : ""}
                </Button>
                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  <CheckCircle2 className="mr-1 inline size-3.5" aria-hidden="true" />
                  Rate-limited and validated server-side. No card data ever touches this site.
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        {/* --------------------------------------------------------- side column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="size-4 text-muted-foreground" aria-hidden="true" />
                Prefer to advertise?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              We run a small number of clearly-labelled ad slots. Reach an audience actively
              comparing AI tools —{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigate({ view: "contact" }, { scroll: true })}
              >
                get the media kit via the contact form
              </button>
              .
            </CardContent>
          </Card>
          <AdSlot navigate={navigate} />
        </div>
      </div>
    </div>
  );
}
