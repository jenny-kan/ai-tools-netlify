import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/**
 * Shared security toolkit (server-side only).
 *
 * Covers the OWASP Top 10 2025 basics in one place:
 *  - A05 Insecure Cryptography   → scrypt password hashing, hashed session tokens
 *  - A07 Auth Failures           → password policy, generic errors, lockout helpers
 *  - A01 Broken Access Control   → origin checks (CSRF defence for cookie auth)
 *  - A09 Logging Failures        → append-only audit trail
 */

// ------------------------------------------------------------- password hash

const SCRYPT_N = 16384; // CPU cost
const SCRYPT_r = 8; // memory cost
const SCRYPT_p = 1; // parallelization
const KEY_LEN = 64;

/** Hash a password with scrypt → "scrypt:N:r:p:saltB64:hashB64". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p });
  return `scrypt:${SCRYPT_N}:${SCRYPT_r}:${SCRYPT_p}:${salt.toString("base64")}:${hash.toString("base64")}`;
}

/** Verify a password against its stored scrypt hash (constant-time). */
export function verifyPasswordHash(password: string, stored: string): boolean {
  try {
    const parts = stored.split(":");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    const actual = scryptSync(password, salt, expected.length, { N, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------- password policy

/** Minimum lengths — bloggers 20+, admins 48+ (enforced even in the demo). */
export const BLOGGER_PASSWORD_MIN = 20;
export const ADMIN_PASSWORD_MIN = 48;

export const PASSWORD_RULES = [
  { key: "length", label: `At least ${BLOGGER_PASSWORD_MIN} characters`, test: (pw: string, min = BLOGGER_PASSWORD_MIN) => pw.length >= min },
  { key: "letter", label: "Contains a letter", test: (pw: string) => /[A-Za-z]/.test(pw) },
  { key: "number", label: "Contains a number", test: (pw: string) => /\d/.test(pw) },
  { key: "case", label: "At least 1 lower and 1 upper", test: (pw: string) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
] as const;

export interface PasswordPolicyResult {
  ok: boolean
  errors: string[]
}

/** Validate a password against the policy (min length configurable: 20 bloggers, 48 admin). */
export function validatePasswordPolicy(password: string, minLength = BLOGGER_PASSWORD_MIN): PasswordPolicyResult {
  const errors: string[] = [];
  if (password.length < minLength) errors.push(`At least ${minLength} characters`);
  if (!/[A-Za-z]/.test(password)) errors.push("Contains a letter");
  if (!/\d/.test(password)) errors.push("Contains a number");
  if (!(/[a-z]/.test(password) && /[A-Z]/.test(password))) errors.push("At least 1 lower and 1 upper");
  if (password.length > 256) errors.push("Shorter than 256 characters");
  return { ok: errors.length === 0, errors };
}

/** Server-side strong password generator (used for demo seeds / suggestions). */
export function generateStrongPassword(length = 24): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (set: string) => set[randomBytes(1)[0] % set.length];
  // Guarantee one of each class, fill the rest, then shuffle.
  const chars = [pick(upper), pick(upper), pick(lower), pick(lower), pick(digits), pick(digits)];
  while (chars.length < Math.max(length, 20)) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ------------------------------------------------------------- rate limiting

/** Sliding-window rate limiter: key → accepted timestamps. In memory. */
const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean
  /** Seconds until the oldest event leaves the window (set when blocked). */
  retryAfterSec?: number
}

/** Check and record in one call. `limit` events per `windowMs` per key. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  buckets.set(key, recent);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, ts] of buckets) {
      if (ts.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return { ok: true };
}

// ------------------------------------------------------------ CSRF / origin

/**
 * Defence-in-depth against CSRF for cookie-authenticated mutations.
 *
 * Primary signal: Fetch Metadata (`Sec-Fetch-Site`) — computed by the browser
 * from the URL the user actually sees, impossible to forge from JS, and immune
 * to proxies that rewrite Host/Origin headers. `same-origin` and `none`
 * (address-bar navigation) pass; `cross-site`/`same-site` are rejected
 * (`same-site` also blocks other subdomains sharing cookies with ours).
 *
 * Fallback (no Fetch Metadata — curl, exotic clients): compare the Origin /
 * Referer host against the Host header plus the whole X-Forwarded-Host chain,
 * because reverse proxies may replace or append to either.
 */
export function isSameOrigin(req: Request): boolean {
  // 1) Fetch Metadata — browsers set it on every request, JS can't spoof it.
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return true;
  if (fetchSite) {
    // cross-site / same-site → reject. Log the rejection for diagnostics —
    // proxy rewrites that break header matching show up here immediately.
    console.warn(
      `[security] origin rejected by fetch metadata: site=${fetchSite} origin=${req.headers.get("origin") ?? "-"} host=${req.headers.get("host") ?? "-"}`
    );
    return false;
  }

  // 2) Header comparison fallback for clients without Fetch Metadata.
  const host = req.headers.get("host");
  if (!host) return false;
  // Candidate hosts this request may legitimately claim: Host plus every hop
  // in X-Forwarded-Host (some proxies append, some overwrite — trust the chain).
  const candidates = new Set<string>();
  candidates.add(host.toLowerCase());
  const fwdHost = req.headers.get("x-forwarded-host");
  if (fwdHost) {
    for (const part of fwdHost.split(",")) {
      const h = part.trim().toLowerCase();
      if (h) candidates.add(h);
    }
  }

  const originHeader = req.headers.get("origin") ?? req.headers.get("referer");
  if (!originHeader) {
    // Non-browser clients (curl) send no Origin. They also send no cookies
    // unless explicitly configured, so cookie-CSRF doesn't apply to them —
    // let the auth checks govern. (Browsers always send Sec-Fetch-Site, so
    // a browser can never reach this branch.)
    return true;
  }
  try {
    const origin = new URL(originHeader);
    return candidates.has(origin.host.toLowerCase()) || candidates.has(origin.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** 403 response for cross-origin mutations. */
export function forbiddenOrigin(): Response {
  return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
}

// -------------------------------------------------------------- client utils

const IP_RE = /^[0-9a-fA-F.:]{3,45}$/; // IPv4, IPv6, IPv4-mapped — nothing else

/** Best-effort client IP for rate limiting / audit logs (behind the gateway). */
export function getClientIp(req: Request): string {
  // Vercel and similar platforms expose the connection IP directly.
  const candidates = [
    req.headers.get("x-vercel-forwarded-for"),
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-real-ip"),
  ];
  for (const header of candidates) {
    if (!header) continue;
    // Take the leftmost *valid-looking* entry: on platforms that overwrite the
    // header (Vercel, our gateway) that is the client; junk entries injected by
    // append-style proxies are skipped instead of becoming free rate-limit keys.
    for (const part of header.split(",")) {
      const ip = part.trim();
      if (IP_RE.test(ip)) return ip;
    }
  }
  return "unknown";
}

// ---------------------------------------------------------------- audit log

export type AuditActor = "admin" | "blogger" | "visitor" | "system";

/**
 * Append to the security audit trail. Fire-and-forget: audit failures must
 * never break the user flow, but they are logged to the server console too
 * (OWASP A09 — never swallow logging errors silently).
 */
export function logAudit(action: string, opts: { actorType?: AuditActor; actorId?: string; details?: string; ip?: string } = {}): void {
  const entry = {
    action: action.slice(0, 120),
    actorType: opts.actorType ?? "system",
    actorId: (opts.actorId ?? "").slice(0, 120),
    details: (opts.details ?? "").slice(0, 2000),
    ip: (opts.ip ?? "").slice(0, 64),
  };
  db.auditLog
    .create({ data: entry })
    .catch((e) => console.error("[audit] failed to persist:", action, e instanceof Error ? e.message : e));
}

// ------------------------------------------------------------- sanitization

/** Strip control/zero-width characters — blocks log injection & invisible spam. */
export function sanitizeText(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, "").trim();
}

/** SHA-256 hex of a token (for storing session tokens hashed). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
