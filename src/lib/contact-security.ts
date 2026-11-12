import { createHmac, timingSafeEqual } from "crypto";

/**
 * Spam & abuse protection for the public contact form.
 *
 * Layers:
 *  1. Honeypot field   — hidden input humans never see; bots fill it and get dropped.
 *  2. Timing trap      — form must be open ≥ 5 s before submit (bots post instantly).
 *  3. Math challenge   — server-generated question with an HMAC-signed, single-use,
 *                        time-limited token. Answers are verified server-side, so the
 *                        challenge can't be precomputed or replayed.
 *  4. Rate limiting    — per-IP sliding window (burst + hourly caps), in memory.
 *  5. Strict validation — length caps, email format, reason enum, URL allow-list,
 *                        control-character stripping.
 */

// ------------------------------------------------------------------ challenge

// Key separation: the challenge never reuses the admin password as an HMAC
// key. ADMIN_SECRET (random, required in production) is the proper source;
// the constant fallback keeps the dev demo working.
const CHALLENGE_SECRET = process.env.ADMIN_SECRET ?? "atf-contact-secret";

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // challenge is valid for 10 minutes

export interface ContactChallenge {
  /** Human-readable question, e.g. "What is 7 + 5?" */
  question: string;
  /** Opaque token: expiry + nonce + HMAC — the answer itself is NOT in the
   *  token, so a script can't just read it out of the page. */
  token: string;
}

function sign(payload: string): string {
  return createHmac("sha256", CHALLENGE_SECRET).update(payload).digest("hex");
}

/** Generate a fresh math challenge bound to a short-lived signed token. */
export function createChallenge(): ContactChallenge {
  const a = 2 + Math.floor(Math.random() * 9); // 2–10
  const b = 1 + Math.floor(Math.random() * 9); // 1–9
  const exp = Date.now() + CHALLENGE_TTL_MS;
  const answer = a + b;
  const nonce = Math.random().toString(36).slice(2, 10);
  const token = `${exp}.${nonce}.${sign(`${exp}:${nonce}:${answer}`)}`;
  return { question: `What is ${a} + ${b}?`, token };
}

/** Verify a math-challenge answer against its signed token. The token never
 *  carries the answer — we HMAC the *supplied* answer and compare, so the
 *  only way to pass is to actually solve the question. */
export function verifyChallenge(token: string | undefined | null, answer: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expRaw, nonce, sig] = parts;
  if (!/^\d+$/.test(expRaw) || !/^[a-z0-9]+$/.test(nonce)) return false;

  const exp = Number(expRaw);
  if (exp < Date.now()) return false; // expired

  // Constant-time signature check over exp:nonce:<supplied answer>.
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(sign(`${expRaw}:${nonce}:${answer.trim()}`), "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  // Single-use: burn the nonce so a solved challenge can't be replayed.
  if (usedNonces.has(nonce)) return false;
  usedNonces.set(nonce, exp);
  pruneNonces();
  return true;
}

/** Nonces of challenges that have already been answered (single-use
 *  enforcement), mapped to their expiry. Pruning drops only EXPIRED entries —
 *  a blanket clear() would un-burn recent nonces and open a replay window. */
const usedNonces = new Map<string, number>();

function pruneNonces(): void {
  if (usedNonces.size < 500) return;
  const now = Date.now();
  for (const [nonce, exp] of usedNonces) {
    if (exp < now) usedNonces.delete(nonce);
  }
}

// ---------------------------------------------------------------- rate limits

/** Sliding-window buckets: key -> timestamps of accepted events. */
const buckets = new Map<string, number[]>();

const BURST_LIMIT = 3; // max 3 stored messages…
const BURST_WINDOW_MS = 60 * 1000; // …per rolling minute
const HOURLY_LIMIT = 5; // max 5 stored messages…
const HOURLY_WINDOW_MS = 60 * 60 * 1000; // …per rolling hour
const CHALLENGE_LIMIT = 30; // challenge fetches per hour (refresh spam)
const FAIL_LIMIT = 15; // failed validation attempts per hour (brute-force cap)

/** Check the limit without recording an event. */
export function peekRateLimit(key: string, kind: "contact" | "challenge" | "fail"): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const recent = (buckets.get(`${kind}:${key}`) ?? []).filter((t) => now - t < HOURLY_WINDOW_MS);

  if (kind === "contact") {
    const burst = recent.filter((t) => now - t < BURST_WINDOW_MS);
    if (burst.length >= BURST_LIMIT || recent.length >= HOURLY_LIMIT) {
      return { ok: false, retryAfterSec: retryAfter(recent, now) };
    }
    return { ok: true };
  }

  if (kind === "fail") {
    if (recent.length >= FAIL_LIMIT) return { ok: false, retryAfterSec: retryAfter(recent, now) };
    return { ok: true };
  }

  // challenge fetches
  if (recent.length >= CHALLENGE_LIMIT) return { ok: false, retryAfterSec: retryAfter(recent, now) };
  return { ok: true };
}

function retryAfter(recent: number[], now: number): number {
  const burst = recent.filter((t) => now - t < BURST_WINDOW_MS);
  const candidates = [
    burst.length >= BURST_LIMIT ? BURST_WINDOW_MS - (now - burst[0]) : 0,
    recent.length >= 1 ? HOURLY_WINDOW_MS - (now - recent[0]) : 0,
  ].filter((ms) => ms > 0);
  return Math.max(1, Math.ceil(Math.min(...(candidates.length ? candidates : [60000])) / 1000));
}

/** Record an event against a bucket (call after peekRateLimit returned ok). */
export function recordRateEvent(key: string, kind: "contact" | "challenge" | "fail"): void {
  const k = `${kind}:${key}`;
  const now = Date.now();
  const recent = (buckets.get(k) ?? []).filter((t) => now - t < HOURLY_WINDOW_MS);
  recent.push(now);
  buckets.set(k, recent);
}

export function checkRateLimit(key: string, kind: "challenge"): { ok: boolean; retryAfterSec?: number } {
  const peeked = peekRateLimit(key, kind);
  if (!peeked.ok) return peeked;
  recordRateEvent(key, kind);
  return { ok: true };
}

// ------------------------------------------------------------------ validation

export const CONTACT_REASONS = ["FEEDBACK", "ISSUE", "SUGGESTION", "TOOL_SUGGESTION", "OTHER"] as const;
export type ContactReason = (typeof CONTACT_REASONS)[number];

export const MESSAGE_STATUSES = ["NEW", "READ", "ARCHIVED"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export function isContactReason(v: unknown): v is ContactReason {
  return typeof v === "string" && (CONTACT_REASONS as readonly string[]).includes(v);
}

export function isMessageStatus(v: unknown): v is MessageStatus {
  return typeof v === "string" && (MESSAGE_STATUSES as readonly string[]).includes(v);
}

/** Strip control characters (incl. zero-width) — blocks log injection & invisible spam. */
export function sanitizeText(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, "").trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ContactInput {
  name: string;
  email: string;
  reason: ContactReason;
  subject: string;
  message: string;
  toolName: string;
  toolUrl: string;
}

export type ValidationResult =
  | { ok: true; value: ContactInput }
  | { ok: false; field: string; error: string };

/** Field-level validation with conservative length caps. */
export function validateContact(b: Record<string, unknown>): ValidationResult {
  const name = sanitizeText(typeof b.name === "string" ? b.name : "");
  const email = sanitizeText(typeof b.email === "string" ? b.email : "").toLowerCase();
  const subject = sanitizeText(typeof b.subject === "string" ? b.subject : "");
  const message = sanitizeText(typeof b.message === "string" ? b.message : "");
  const toolName = sanitizeText(typeof b.toolName === "string" ? b.toolName : "");
  const toolUrl = sanitizeText(typeof b.toolUrl === "string" ? b.toolUrl : "");

  if (name.length < 2 || name.length > 80) {
    return { ok: false, field: "name", error: "Please enter your name (2–80 characters)." };
  }
  if (!EMAIL_RE.test(email) || email.length > 120) {
    return { ok: false, field: "email", error: "Please enter a valid email address so we can reply." };
  }
  if (!isContactReason(b.reason)) {
    return { ok: false, field: "reason", error: "Please choose a reason for contacting us." };
  }
  if (subject.length < 3 || subject.length > 120) {
    return { ok: false, field: "subject", error: "Subject must be 3–120 characters." };
  }
  if (message.length < 20 || message.length > 4000) {
    return { ok: false, field: "message", error: "Message must be 20–4000 characters." };
  }
  if (b.reason === "TOOL_SUGGESTION") {
    if (toolName.length < 2 || toolName.length > 80) {
      return { ok: false, field: "toolName", error: "Please tell us the tool's name (2–80 characters)." };
    }
    if (toolUrl) {
      const checked = checkUrl(toolUrl);
      if (!checked.ok) return { ok: false, field: "toolUrl", error: checked.error };
    }
  } else if (toolUrl) {
    const checked = checkUrl(toolUrl);
    if (!checked.ok) return { ok: false, field: "toolUrl", error: checked.error };
  }

  return {
    ok: true,
    value: { name, email, reason: b.reason, subject, message, toolName: b.reason === "TOOL_SUGGESTION" ? toolName : "", toolUrl: b.reason === "TOOL_SUGGESTION" ? toolUrl : "" },
  };
}

/** Only http(s) URLs are accepted; blocks javascript:, data:, etc. */
export function checkUrl(raw: string): { ok: true } | { ok: false; error: string } {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "URL must start with http:// or https://." };
    }
    if (raw.length > 300) return { ok: false, error: "URL is too long (max 300 characters)." };
    return { ok: true };
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
}

/** Extract a client IP from proxy headers (best effort, for rate limiting only).
 *  Mirrors the hardened getClientIp in lib/security.ts: prefer the platform
 *  header, then the leftmost *valid-looking* XFF entry (spoofed junk entries
 *  can't mint fresh rate-limit keys). */
export function clientIp(req: Request): string {
  const ipRe = /^[0-9a-fA-F.:]{3,45}$/;
  const candidates = [
    req.headers.get("x-vercel-forwarded-for"),
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-real-ip"),
  ];
  for (const header of candidates) {
    if (!header) continue;
    for (const part of header.split(",")) {
      const ip = part.trim();
      if (ipRe.test(ip)) return ip;
    }
  }
  return "unknown";
}
