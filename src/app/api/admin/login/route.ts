import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminAuthConfigured, adminDisabled, createAdminToken, verifyPassword } from "@/lib/admin-auth";
import { forbiddenOrigin, getClientIp, isSameOrigin, logAudit, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

/** Admin sign-in — rate-limited, audited, strict about origin (CSRF).
 *  Fails closed in production when the env vars aren't configured. */
export async function POST(req: NextRequest) {
  if (!adminAuthConfigured()) return adminDisabled();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const limited = rateLimit(`admin-login:${ip}`, 8, 15 * 60 * 1000);
  if (!limited.ok) {
    logAudit("admin.login.rateLimited", { actorType: "visitor", ip });
    return NextResponse.json(
      { error: `Too many attempts — try again in ${Math.ceil(limited.retryAfterSec! / 60)} minutes.` },
      { status: 429 }
    );
  }

  let password = "";
  try {
    const body: unknown = await req.json();
    if (typeof body === "object" && body !== null) {
      const pw = (body as Record<string, unknown>).password;
      if (typeof pw === "string") password = pw;
    }
  } catch {
    // fall through to failure below
  }

  if (!password || !verifyPassword(password)) {
    logAudit("admin.login.failed", { actorType: "visitor", ip });
    // Generic message — never reveal whether the password was close.
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  logAudit("admin.login.success", { actorType: "admin", ip });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
  return res;
}
