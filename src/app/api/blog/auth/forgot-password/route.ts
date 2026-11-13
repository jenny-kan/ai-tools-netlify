import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  forbiddenOrigin,
  getClientIp,
  isSameOrigin,
  logAudit,
  rateLimit,
  sha256,
} from "@/lib/security";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESET_TTL_MS = 60 * 60 * 1000; // 60 minutes
/** Keep at most 3 live tokens per blogger — older ones are pruned. */
const MAX_LIVE_TOKENS = 3;

/**
 * Public: request a password-reset email for a registered blogger.
 *
 * Security model (OWASP A07):
 *  - The response is ALWAYS the same generic "if that account exists…" message,
 *    whether or not the email is registered — no account enumeration.
 *  - The reset token is 256 bits of CSPRNG entropy, travels only in the email
 *    link, and only its SHA-256 hash is stored (a DB leak can't be replayed).
 *  - Tokens expire after 60 minutes; requesting a new one invalidates the
 *    blogger's oldest tokens (max 3 live at once).
 *  - Per-IP rate limit (5/hour) prevents email-bombing through this endpoint.
 *  - In dry-run mode (no RESEND_API_KEY) the response includes the reset URL so
 *    the flow stays fully testable in demo environments. That field is never
 *    present when a real email is delivered.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const limited = rateLimit(`blog-forgot:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) {
    logAudit("blogger.forgot.rateLimited", { actorType: "visitor", ip });
    return Response.json(
      { error: `Too many reset requests — try again in ${Math.ceil(limited.retryAfterSec! / 60)} minutes.` },
      { status: 429 }
    );
  }

  const raw: unknown = await req.json().catch(() => null);
  const email =
    typeof raw === "object" && raw !== null
      ? String((raw as Record<string, unknown>).email ?? "").trim().toLowerCase()
      : "";

  if (!EMAIL_RE.test(email) || email.length > 120) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const genericOk = {
    ok: true,
    message:
      "If that email belongs to an approved or pending blogger account, a reset link is on its way. It expires in 60 minutes.",
  };

  // Only APPROVED / PENDING accounts can reset (REJECTED / SUSPENDED can't
  // sign in anyway — a reset link would be misleading).
  const blogger = await db.blogger.findUnique({ where: { email } });
  if (!blogger || (blogger.status !== "APPROVED" && blogger.status !== "PENDING")) {
    logAudit("blogger.forgot.unknownEmail", { actorType: "visitor", ip, details: email });
    return Response.json(genericOk); // identical response — no enumeration
  }

  // Generate the token, store only its hash.
  const token = randomBytes(32).toString("base64url");
  await db.bloggerPasswordReset.create({
    data: {
      tokenHash: sha256(token),
      bloggerId: blogger.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  // Prune this blogger's oldest tokens beyond the cap.
  const live = await db.bloggerPasswordReset.findMany({
    where: { bloggerId: blogger.id },
    orderBy: { createdAt: "desc" },
    take: MAX_LIVE_TOKENS + 1,
  });
  if (live.length > MAX_LIVE_TOKENS) {
    await db.bloggerPasswordReset.deleteMany({
      where: { id: { in: live.slice(MAX_LIVE_TOKENS).map((t) => t.id) } },
    });
  }

  // Build the link. Emails need an absolute URL — use NEXT_PUBLIC_SITE_URL when
  // configured (required in production), else the request origin as a fallback.
  // In dry-run mode the response link stays RELATIVE so the browser resolves it
  // against whatever origin the visitor actually sees (proxies notwithstanding).
  const linkPath = `/?view=blogger&mode=reset&token=${token}`;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? req.nextUrl.origin;
  const resetUrl = `${base}${linkPath}`;

  const result = await sendEmail({
    to: blogger.email,
    subject: "Reset your ai tools central blogger password",
    text: [
      `Hi ${blogger.name},`,
      "",
      "Somebody (hopefully you) asked to reset the password for your blogger account.",
      "",
      "Open the link below to choose a new password — it works once and expires in 60 minutes:",
      "",
      resetUrl,
      "",
      "If you didn't request this, you can safely ignore the email; your current password stays active.",
    ].join("\n"),
  });

  logAudit("blogger.forgot.tokenIssued", {
    actorType: "blogger",
    actorId: blogger.id,
    ip,
    details: result.dryRun ? "dry-run" : `email ${result.emailId}`,
  });

  if (result.dryRun) {
    // No mail provider configured — return the (relative) link so the demo
    // flow works from any origin the visitor is browsing from.
    return Response.json({ ...genericOk, dryRun: true, resetUrl: linkPath });
  }
  if (!result.delivered) {
    // Provider error — still report the generic message (no internals leak).
    logAudit("blogger.forgot.sendFailed", { actorType: "system", actorId: blogger.id, details: result.detail });
  }
  return Response.json(genericOk);
}
