# Security model

This document summarizes how ai-tools-central protects itself, what a formal
audit found and fixed, and what you should harden when you outgrow the demo.

## Threat model

- **Public visitors** can browse, search, apply as bloggers, submit the contact
  form (with anti-bot defenses), donate (demo), and generate analytics events.
- **Bloggers** (admin-approved) can create/edit/delete **their own** drafts and
  submit them to an editorial queue. They can never publish directly.
- **The admin** (single shared password, rate-limited) manages everything.
- Everything runs server-side on the Node.js runtime — no secrets ever reach
  the browser bundle.

## Controls in place

### Authentication & sessions

| Control | Implementation |
| --- | --- |
| Password hashing | scrypt (N=16384, r=8, per-hash salt), constant-time verification |
| Password policy | Bloggers ≥ 20 chars (upper+lower+digit), admin ≥ 48 chars — enforced server-side, plus strong client/server-side generators |
| Blogger sessions | 256-bit tokens in httpOnly/sameSite=lax cookies; only SHA-256 hashes stored in the DB; 7-day expiry; destroyed on logout and on password reset |
| Admin sessions | HMAC-signed tokens (`exp` + random `jti` + signature), 24h TTL, httpOnly cookie; **fail-closed in production** — without `ADMIN_PASSWORD` + `ADMIN_SECRET` every admin route returns 503 |
| Login hardening | Per-IP rate limits, per-account lockout after 5 failures (15 min), dummy-hash verification for unknown accounts, generic error messages (no account enumeration) |
| Forgot password | 256-bit one-time tokens, only SHA-256 hashes stored, 60-minute expiry, max 3 live tokens per account, all sessions invalidated on reset, enumeration-safe responses, per-IP rate limit |

### Request-level defenses

| Control | Implementation |
| --- | --- |
| CSRF | Fetch Metadata (`Sec-Fetch-Site`) as the primary signal on **every** mutating route, with an Origin/Referer + Host/X-Forwarded-Host fallback for non-browser clients |
| Rate limiting | Sliding-window, per-IP, per-endpoint (login, signup, contact, reset, admin, imports, analytics) |
| Input validation | Strict length caps and type checks on every public field; Prisma's parameterized queries everywhere (no raw SQL from user input) |
| XSS | Markdown rendered with react-markdown **without** rehype-raw (HTML escaped); JSON-LD blocks serialized with `<`/U+2028/U+2029 escaping (`safeJsonLd`) |
| Email injection | CR/LF stripped from every outgoing header field; Resend API (no SMTP daemon) |
| Security headers | CSP (no `unsafe-eval` in production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS+preload in production, `X-Powered-By` removed |
| Audit trail | Every auth event, application decision, publish action, import and email is written to a capped, queryable `AuditLog` table (visible in the admin analytics tab) |
| Anti-spam (contact) | Honeypot with fake success, timing trap, HMAC-signed single-use math challenge whose answer never leaves the server, burst + hourly quotas |

### Privacy

- Analytics stores path + referrer-origin + an anonymous client-generated
  session id. No cookies, no PII, no fingerprinting.
- The contact inbox stores sender email/IP only for the purpose of replying;
  no database file exists in the repo at all (data lives in your Postgres).
- `GET /api/download` streams the clean source package (application code,
  configs, docs — never `.env`, databases, logs or git history). It is public
  in development for one-click downloads and **admin-gated in production**
  (fail closed); `SOURCE_DOWNLOAD_PUBLIC` overrides either direction, and the
  endpoint is rate-limited (20/hour/IP) because zipping is CPU work.

## Audit results (pre-release hardening)

A full OWASP-oriented review was performed before packaging. Key findings and
their fixes:

1. **Admin fail-open (critical)** — the demo password authenticated production
   when `ADMIN_PASSWORD` was unset, and the session endpoint disclosed it.
   → *Fixed:* production fails closed (503) without both `ADMIN_PASSWORD` and
   an independent `ADMIN_SECRET`; the demo disclosure is development-only.
2. **Secrets in git (critical)** — `.env` and `db/custom.db` were tracked.
   → *Fixed:* untracked and gitignored. **If you push this repo's history to a
   public remote, scrub it first** (`git filter-repo`) or start from the clean
   download package, which has no git history at all.
3. **Stored XSS via JSON-LD (high)** — `JSON.stringify` doesn't escape
   `</script>`, so a blogger title could break out of the structured-data block.
   → *Fixed:* `safeJsonLd()` escapes `<` and line separators; production CSP
   also drops `unsafe-eval`.
4. **Uneven CSRF coverage (high)** — several admin/blogger mutations skipped
   the origin check. → *Fixed:* every POST/PUT/PATCH/DELETE now enforces it.
5. **Account enumeration (high)** — signup returned 409 for known emails and
   lockouts leaked a distinct 423. → *Fixed:* duplicate signups return the
   identical success response; wrong-password attempts always return 401.
6. **Contact challenge (medium)** — the answer traveled inside the (public)
   token, and the nonce store could mass-un-burn. → *Fixed:* the token now
   carries only exp + nonce + HMAC; verification HMACs the *supplied* answer;
   nonce pruning removes only expired entries.
7. **Query logging / IP spoofing / misc (medium/low)** — Prisma SQL logging is
   disabled in production; client-IP parsing validates candidates and prefers
   platform headers; deterministic admin tokens now carry a random component.

## Known limits (honest disclosure)

These are deliberate trade-offs for a self-contained, zero-service demo. Harden
them before operating at scale:

1. **In-memory rate limiting & nonces.** Correct for a single instance
   (Railway/Render/Docker), best-effort on serverless (each lambda keeps its
   own counters). For serverless at scale, back the limiter with Upstash Redis
   or Vercel KV — `rateLimit()` in `src/lib/security.ts` is the single seam to
   swap.
2. **CSP keeps `unsafe-inline` for scripts.** Next.js inline hydration scripts
   need it without a nonce. To go strict: add a middleware that issues a
   per-request nonce and Next will propagate it — then drop `unsafe-inline`.
3. **Admin sessions are stateless.** A stolen token is valid up to 24h and
   logout only clears the cookie. Rotating `ADMIN_SECRET` invalidates all
   tokens instantly. For revocable sessions, mirror the `BloggerSession`
   pattern in a DB table.
4. **Donation "confirm" endpoint is a demo.** It flips a PENDING donation to
   COMPLETED by id. Replace it with a signature-verified webhook from your
   payment provider before wiring real money.
5. **Password-reset links in dry-run mode.** Without `RESEND_API_KEY` the reset
   URL is returned in the API response (so the demo works). This is documented
   behavior — set the key in production and the URL never appears in responses.
6. **PostgreSQL-only.** The app accepts only `postgres://` connection
   strings and fails closed otherwise — there is no embedded/local-file
   database mode to misconfigure.

## Dependency posture (post-upgrade audit)

All dependencies were upgraded to their latest **stable and compatible**
versions (Next 16.4, React 19.3, Prisma 7.10, Tailwind 4.3, ESLint 9.39,
TypeScript 5.9) and re-audited:

- `pnpm audit` — **no known vulnerabilities** in the production tree.
- Two "latest" majors were deliberately **not** taken, for compatibility:
  ESLint 10 (eslint-config-next's plugin chain supports ^9) and TypeScript 7
  (typescript-eslint supports <6.1). Prisma 8 is still a release candidate.
- pnpm's supply-chain settings stay strict: install scripts blocked for
  everything except the five allow-listed packages, and the
  minimum-release-age gate runs with **zero exceptions** (lucide-react was
  pinned to an 11-day-old release instead of a same-day one).

## Reporting

Found something? Open an issue or email the editors via the contact form —
reports are triaged from the admin inbox.
