import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  peekRateLimit,
  recordRateEvent,
  clientIp,
  validateContact,
  verifyChallenge,
} from "@/lib/contact-security";

/**
 * Public: submit a contact message.
 *
 * Spam defense (in order):
 *  1. Per-IP burst/hourly quota for stored messages + a separate, higher
 *     cap for failed attempts (brute-force protection) → 429
 *  2. Honeypot field must be empty (bots fill hidden inputs) → fake success
 *  3. Timing trap: page must have been open ≥ 5 s → fake success for bots
 *  4. Single-use, HMAC-signed math challenge must be answered → 400
 *  5. Strict field validation → 400
 *
 * Fake-success responses (202) tell bots "done" without revealing which
 * defense caught them or storing the spam. Only messages that pass every
 * layer are stored — and only those count against the hourly quota, so a
 * human who typos the challenge isn't locked out.
 */

const MIN_FILL_TIME_MS = 5_000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // 1a. Hard quota on stored messages.
  const contactLimit = peekRateLimit(ip, "contact");
  if (!contactLimit.ok) {
    return NextResponse.json(
      {
        error: `You've sent several messages recently. Please wait ${Math.ceil(
          (contactLimit.retryAfterSec ?? 60) / 60
        )} minute(s) before trying again.`,
      },
      { status: 429, headers: { "Retry-After": String(contactLimit.retryAfterSec ?? 60) } }
    );
  }

  // 1b. Failed-attempt cap (challenge brute-forcing / malformed spam).
  const failLimit = peekRateLimit(ip, "fail");
  if (!failLimit.ok) {
    return NextResponse.json(
      { error: "Too many invalid attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(failLimit.retryAfterSec ?? 60) } }
    );
  }

  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    recordRateEvent(ip, "fail");
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  // 2. Honeypot — hidden "website" field. Humans never see it; bots autofill.
  const honeypot = typeof b.website === "string" ? b.website.trim() : "";
  if (honeypot !== "") {
    // Pretend success so the bot moves on; store nothing.
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  // 3. Timing trap — the client reports when the form page loaded.
  const loadedAt = Number(b.loadedAt);
  if (!Number.isFinite(loadedAt) || Date.now() - loadedAt < MIN_FILL_TIME_MS) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  // 4. Math challenge — verify the single-use signed token server-side.
  const challengeToken = typeof b.challengeToken === "string" ? b.challengeToken : "";
  const challengeAnswer = typeof b.challengeAnswer === "string" ? b.challengeAnswer : "";
  if (!verifyChallenge(challengeToken, challengeAnswer)) {
    recordRateEvent(ip, "fail");
    return NextResponse.json(
      { error: "Please answer the security question correctly.", field: "challenge" },
      { status: 400 }
    );
  }

  // 5. Validate fields.
  const validated = validateContact(b);
  if (!validated.ok) {
    recordRateEvent(ip, "fail");
    return NextResponse.json(
      { error: validated.error, field: validated.field },
      { status: 400 }
    );
  }

  // Store the message (keep a truncated IP for abuse follow-up only) and
  // commit it against the stored-message quota.
  await db.contactMessage.create({
    data: {
      ...validated.value,
      ipAddress: ip.slice(0, 45),
    },
  });
  recordRateEvent(ip, "contact");

  return NextResponse.json({ ok: true }, { status: 201 });
}
