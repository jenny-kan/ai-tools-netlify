import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_PASSWORD_MIN } from "@/lib/security";

/**
 * Server-side admin authentication.
 *
 * Security posture (OWASP 2025 A02/A05/A07):
 *  - The admin password must be ≥ 48 characters — even the demo default.
 *  - A signed HMAC token (with a random per-login id) in an httpOnly cookie
 *    protects every admin API route.
 *  - Login is rate-limited and audited in the login route itself.
 *
 * PRODUCTION IS FAIL-CLOSED: the demo password only works in development. In
 * production both ADMIN_PASSWORD (48+ chars) and an independent random
 * ADMIN_SECRET must be set — otherwise every admin route refuses to
 * authenticate (503) instead of silently falling back to a guessable default.
 */

/** 59-char demo default — meets the ≥ 48 char admin policy (upper/lower/digits).
 *  DEVELOPMENT ONLY: never used when NODE_ENV=production. */
export const ADMIN_DEMO_PASSWORD = "Admin-Demo-2025-Use-This-48-Char-Password-Abcdef-1234567890";

const IS_PROD = process.env.NODE_ENV === "production";
const ENV_PASSWORD = process.env.ADMIN_PASSWORD;
const ENV_SECRET = process.env.ADMIN_SECRET;

/** True when the environment provides a real (non-demo) admin configuration. */
export function adminAuthConfigured(): boolean {
  if (!IS_PROD) return true; // development keeps the demo workflow
  return Boolean(ENV_PASSWORD && ENV_PASSWORD.length >= ADMIN_PASSWORD_MIN && ENV_SECRET);
}

const ADMIN_PASSWORD = IS_PROD && !ENV_PASSWORD ? "" : (ENV_PASSWORD ?? ADMIN_DEMO_PASSWORD);

// Fail loudly (server console) if an operator sets a weak ADMIN_PASSWORD.
if (ENV_PASSWORD && ENV_PASSWORD.length < ADMIN_PASSWORD_MIN) {
  console.warn(
    `[security] ADMIN_PASSWORD is only ${ENV_PASSWORD.length} chars — ` +
      `the admin policy requires at least ${ADMIN_PASSWORD_MIN}. Set a stronger value.`
  );
}
if (IS_PROD && !adminAuthConfigured()) {
  console.error(
    "[security] ADMIN_PASSWORD (48+ chars) and ADMIN_SECRET (random, e.g. `openssl rand -hex 32`) " +
      "must both be set in production — admin routes are disabled until they are."
  );
}

// The signing key is ADMIN_SECRET in production; the password-derived value is
// a development convenience only (the demo password is public by design).
const SECRET = ENV_SECRET ?? `atf-${ADMIN_DEMO_PASSWORD}-secret`;

export const ADMIN_COOKIE = "atf_admin";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function digest(value: string): Buffer {
  return createHmac("sha256", "atf-auth").update(value).digest();
}

/** Constant-time password comparison. False when no password is configured. */
export function verifyPassword(input: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  const a = digest(input);
  const b = digest(ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** exp + random id + HMAC(exp:id) — every login gets a unique token, so
 *  tokens can't be correlated or precomputed across sessions. */
export function createAdminToken(): string {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const jti = randomBytes(12).toString("hex");
  return `${exp}.${jti}.${sign(`${exp}:${jti}`)}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [exp, jti, sig] = parts;
  if (!/^\d+$/.test(exp) || !/^[0-9a-f]{24}$/.test(jti)) return false;
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(sign(`${exp}:${jti}`), "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  return Number(exp) > Date.now();
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!adminAuthConfigured()) return false;
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized — sign in to the admin dashboard first." },
    { status: 401 }
  );
}

/** 503 for production deployments that forgot their env vars — fail closed. */
export function adminDisabled(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Admin access is disabled: set ADMIN_PASSWORD (48+ chars) and ADMIN_SECRET before using the dashboard.",
    },
    { status: 503 }
  );
}
