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
  sha256,
  validatePasswordPolicy,
} from "@/lib/security";

export const runtime = "nodejs";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/; // base64url, 256-bit tokens are 43 chars

/**
 * Public: complete a password reset with the emailed token.
 *
 * Security model (OWASP A07):
 *  - The raw token is only ever seen by the email recipient; the DB stores its
 *    SHA-256 hash, so a leak can't be replayed.
 *  - Single use: every reset token for the account is deleted on success.
 *  - Expired or already-used tokens get the same generic error (no probing).
 *  - The new password must pass the blogger policy (20+ chars, mixed case,
 *    digits) and is stored as a fresh scrypt hash.
 *  - All of the blogger's sessions are destroyed → a stolen password can't
 *    keep an attacker signed in after the rightful owner resets it.
 *  - Per-IP rate limit (10/hour) blunts token brute-force (2^256 space, but
 *    cheap to be safe).
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const limited = rateLimit(`blog-reset:${ip}`, 10, 60 * 60 * 1000);
  if (!limited.ok) {
    logAudit("blogger.reset.rateLimited", { actorType: "visitor", ip });
    return Response.json(
      { error: `Too many attempts — try again in ${Math.ceil(limited.retryAfterSec! / 60)} minutes.` },
      { status: 429 }
    );
  }

  const raw: unknown = await req.json().catch(() => null);
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!TOKEN_RE.test(token)) {
    return Response.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  const policy = validatePasswordPolicy(password, BLOGGER_PASSWORD_MIN);
  if (!policy.ok) {
    return Response.json(
      { error: `Password doesn't meet the policy: ${policy.errors.join("; ")}.` },
      { status: 400 }
    );
  }

  const reset = await db.bloggerPasswordReset.findUnique({
    where: { tokenHash: sha256(token) },
    include: { blogger: true },
  });

  // Generic error for missing, used, or expired tokens — indistinguishable.
  if (!reset || reset.expiresAt.getTime() < Date.now()) {
    if (reset) {
      // Lazily drop the expired row so it can't be replayed later.
      await db.bloggerPasswordReset.delete({ where: { id: reset.id } }).catch(() => undefined);
    }
    logAudit("blogger.reset.invalidToken", { actorType: "visitor", ip });
    return Response.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  // Success: new hash, burn every reset token, kill every session.
  const [blogger] = await db.$transaction([
    db.blogger.update({
      where: { id: reset.bloggerId },
      data: {
        passwordHash: hashPassword(password),
        loginAttempts: 0,
        lockedUntil: null,
      },
    }),
    db.bloggerPasswordReset.deleteMany({ where: { bloggerId: reset.bloggerId } }),
    db.bloggerSession.deleteMany({ where: { bloggerId: reset.bloggerId } }),
  ]);

  logAudit("blogger.reset.success", { actorType: "blogger", actorId: blogger.id, ip });

  return Response.json({
    ok: true,
    message:
      blogger.status === "APPROVED"
        ? "Password updated — sign in with your new password."
        : "Password updated. Your application is still under review — sign in once the editors approve it.",
  });
}
