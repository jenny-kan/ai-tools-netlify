import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  BLOGGER_PASSWORD_MIN,
  forbiddenOrigin,
  getClientIp,
  hashPassword,
  isSameOrigin,
  logAudit,
  rateLimit,
  sanitizeText,
  validatePasswordPolicy,
} from "@/lib/security";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Public: apply to become a blogger. Creates a PENDING account — the
 * applicant cannot sign in until an admin approves the application.
 *
 * Abuse controls: origin check, per-IP rate limit, strict validation,
 * 20+ char password policy, scrypt hashing, audit trail.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const limited = rateLimit(`blog-signup:${ip}`, 3, 60 * 60 * 1000);
  if (!limited.ok) {
    logAudit("blogger.signup.rateLimited", { actorType: "visitor", ip });
    return Response.json(
      { error: `Too many applications — try again in ${Math.ceil(limited.retryAfterSec! / 60)} minutes.` },
      { status: 429 }
    );
  }

  const raw: unknown = await req.json().catch(() => null);
  if (typeof raw !== "object" || raw === null) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const b = raw as Record<string, unknown>;

  const name = sanitizeText(typeof b.name === "string" ? b.name : "");
  const email = sanitizeText(typeof b.email === "string" ? b.email : "").toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const bio = sanitizeText(typeof b.bio === "string" ? b.bio : "").slice(0, 300);
  const applicationReason = sanitizeText(typeof b.applicationReason === "string" ? b.applicationReason : "");
  const writingSample = typeof b.writingSample === "string" ? b.writingSample.replace(/\r\n/g, "\n").trim() : "";

  // ---- field validation
  if (name.length < 2 || name.length > 80) {
    return Response.json({ error: "Please enter your name (2–80 characters)." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 120) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const policy = validatePasswordPolicy(password, BLOGGER_PASSWORD_MIN);
  if (!policy.ok) {
    return Response.json(
      { error: `Password doesn't meet the policy: ${policy.errors.join("; ")}.` },
      { status: 400 }
    );
  }
  if (applicationReason.length < 30 || applicationReason.length > 1000) {
    return Response.json({ error: "Tell us why you want to blog here (30–1000 characters)." }, { status: 400 });
  }
  if (writingSample.length < 200 || writingSample.length > 10000) {
    return Response.json(
      { error: "Include a writing sample of 200–10,000 characters so we can judge quality." },
      { status: 400 }
    );
  }

  // ---- duplicate email check — enumeration-safe: identical response either
  // way (no email is sent on signup, so a fake "received" can't spam anyone).
  const existing = await db.blogger.findUnique({ where: { email } });
  if (existing) {
    logAudit("blogger.signup.duplicateEmail", { actorType: "visitor", details: email, ip });
    return Response.json({
      ok: true,
      message:
        "Application received! The editors review applications within 48 hours — you'll be able to sign in once approved.",
    });
  }

  const blogger = await db.blogger.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      bio,
      applicationReason,
      writingSample,
      status: "PENDING",
    },
  });

  logAudit("blogger.signup.created", { actorType: "visitor", actorId: blogger.id, details: name, ip });
  return Response.json({
    ok: true,
    message:
      "Application received! The editors review applications within 48 hours — you'll be able to sign in once approved.",
  });
}
