import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BLOGGER_COOKIE, createBloggerSession } from "@/lib/blogger-auth";
import { forbiddenOrigin, getClientIp, isSameOrigin, logAudit, rateLimit, verifyPasswordHash } from "@/lib/security";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

/**
 * Blogger sign-in.
 *
 * Hardening (OWASP A07 — authentication failures):
 *  - per-IP rate limit + per-account lockout after 5 failed attempts (15 min)
 *  - generic "invalid email or password" — no account enumeration
 *  - scrypt hash verification, server-side sessions, audit trail
 *  - applicants see their application status instead of a session
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const ipLimited = rateLimit(`blog-login:${ip}`, 10, 15 * 60 * 1000);
  if (!ipLimited.ok) {
    logAudit("blogger.login.rateLimited", { actorType: "visitor", ip });
    return NextResponse.json(
      { error: `Too many attempts — try again in ${Math.ceil(ipLimited.retryAfterSec! / 60)} minutes.` },
      { status: 429 }
    );
  }

  const raw: unknown = await req.json().catch(() => null);
  const email = typeof raw === "object" && raw !== null
    ? String((raw as Record<string, unknown>).email ?? "").trim().toLowerCase()
    : "";
  const password = typeof raw === "object" && raw !== null
    ? String((raw as Record<string, unknown>).password ?? "")
    : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const blogger = await db.blogger.findUnique({ where: { email } });

  // Constant-ish work for unknown accounts too (mitigates timing-based enumeration).
  const storedHash = blogger?.passwordHash ?? "scrypt:16384:8:1:AAAA:AAAA";
  const passwordOk = verifyPasswordHash(password, storedHash);

  if (!blogger || !passwordOk) {
    if (blogger) {
      const attempts = blogger.loginAttempts + 1;
      const lock = attempts >= MAX_ATTEMPTS;
      await db.blogger.update({
        where: { id: blogger.id },
        data: {
          loginAttempts: attempts,
          ...(lock ? { lockedUntil: new Date(Date.now() + LOCKOUT_MS) } : {}),
        },
      });
      logAudit("blogger.login.failed", { actorType: "visitor", actorId: blogger.id, ip, details: `attempt ${attempts}${lock ? " (locked)" : ""}` });
    } else {
      logAudit("blogger.login.failed", { actorType: "visitor", details: email, ip });
    }
    // Generic 401 for every wrong-password case — including the attempt that
    // trips the lock, so lockouts can't confirm an email is registered.
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Correct password on a locked account: the requester knows the secret, so
  // telling them about the lock leaks nothing an attacker could use.
  if (blogger.lockedUntil && blogger.lockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((blogger.lockedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Account locked after failed attempts — try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
      { status: 423 }
    );
  }

  // Approved bloggers get a session; everyone else gets their status.
  if (blogger.status !== "APPROVED") {
    logAudit("blogger.login.blocked", { actorType: "blogger", actorId: blogger.id, ip, details: blogger.status });
    const messages: Record<string, string> = {
      PENDING: "Your application is still under review — we'll approve it within 48 hours of applying.",
      REJECTED: "This application wasn't approved. If you think that's a mistake, contact the editors.",
      SUSPENDED: "This account is suspended. Contact the editors for details.",
    };
    return NextResponse.json(
      { error: messages[blogger.status] ?? "This account can't sign in." },
      { status: 403 }
    );
  }

  await db.blogger.update({
    where: { id: blogger.id },
    data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const token = await createBloggerSession(blogger.id);
  logAudit("blogger.login.success", { actorType: "blogger", actorId: blogger.id, ip });

  const res = NextResponse.json({
    blogger: { id: blogger.id, name: blogger.name, email: blogger.email, status: blogger.status },
  });
  res.cookies.set(BLOGGER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
  return res;
}
