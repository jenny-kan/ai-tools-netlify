import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forbiddenOrigin, getClientIp, isSameOrigin, logAudit, rateLimit, sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_CENTS = 100; // $1
const MAX_CENTS = 1_000_000; // $10,000

/**
 * Public: record a donation intent (demo mode — no payment processor).
 * Production deployments wire DONATE_PROVIDER_URL and handle completion
 * via the provider's webhook; this endpoint stays the system of record.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const limited = rateLimit(`donate:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) {
    logAudit("donation.rateLimited", { actorType: "visitor", ip });
    return NextResponse.json(
      { error: `Too many attempts — try again in ${Math.ceil(limited.retryAfterSec! / 60)} minutes.` },
      { status: 429 }
    );
  }

  const raw: unknown = await req.json().catch(() => null);
  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const b = raw as Record<string, unknown>;

  const donorName = sanitizeText(typeof b.donorName === "string" ? b.donorName : "");
  const email = sanitizeText(typeof b.email === "string" ? b.email : "").toLowerCase();
  const message = sanitizeText(typeof b.message === "string" ? b.message : "").slice(0, 500);
  const amountCents = typeof b.amountCents === "number" ? Math.round(b.amountCents) : Number.NaN;

  if (donorName.length < 2 || donorName.length > 80) {
    return NextResponse.json({ error: "Please enter a name we can thank (2–80 characters)." }, { status: 400 });
  }
  if (email && (!EMAIL_RE.test(email) || email.length > 120)) {
    return NextResponse.json({ error: "That email doesn't look valid." }, { status: 400 });
  }
  if (!Number.isInteger(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return NextResponse.json({ error: "Choose an amount between $1 and $10,000." }, { status: 400 });
  }

  const donation = await db.donation.create({
    data: {
      donorName,
      email,
      message,
      amountCents,
      currency: "USD",
      status: "PENDING",
      provider: process.env.DONATE_PROVIDER_URL ? "external" : "demo",
    },
  });

  logAudit("donation.created", { actorType: "visitor", details: `${donorName} — $${(amountCents / 100).toFixed(2)}`, ip });

  return NextResponse.json({
    id: donation.id,
    donorName: donation.donorName,
    email: donation.email,
    amountCents: donation.amountCents,
    currency: donation.currency,
    message: donation.message,
    status: donation.status,
    provider: donation.provider,
    createdAt: donation.createdAt.toISOString(),
  });
}
