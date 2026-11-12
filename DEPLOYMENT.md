# Deploying AI Tool Finder

This guide covers the recommended production setup (**Vercel + Neon**) and the
alternatives (Netlify, Supabase, Railway/Render, Docker/self-host). Work
top-to-bottom — the checklist at the end is mandatory for any public
deployment.

> Running it on your own Mac instead? See **[DEPLOY-MACOS.md](./DEPLOY-MACOS.md)**
> (tested against macOS 10.15 Catalina) — Node 22 via nvm, `pnpm build &&
> pnpm start`, auto-start at login, backups and updates.

---

## 1. Vercel + Neon (recommended)

Serverless hosting + serverless Postgres, both with generous free tiers.

### 1.1 Create the Neon database

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Neon shows **two** connection strings — you need both:
   - **Pooled** (host contains `-pooler`, port `6543`) → runtime connections
   - **Direct** (port `5432`) → migrations / `prisma db push`

### 1.2 Prepare the repo

Nothing to prepare — the app is **PostgreSQL-only**: one
`prisma/schema.prisma` (`provider = "postgresql"`), one driver adapter
(`@prisma/adapter-pg`). Point `DATABASE_URL` at your database and every
install / `db:*` command works against it directly.

### 1.3 Push the schema to Neon and seed

```bash
# In .env locally (or export in your shell):
export DATABASE_URL="postgres://…-pooler…:5432/…?sslmode=require&connection_limit=1"
export DIRECT_DATABASE_URL="postgres://…:5432/…?sslmode=require"

pnpm db:push           # creates all tables (or: pnpm db:migrate --name init)
pnpm db:seed           # seeds the catalog + demo blog data
```

> The demo seed includes demo accounts with known passwords. For a real
> deployment you may want to run only the catalog seed (`tsx prisma/seed.ts`)
> and skip `scripts/seed-blog.ts`.

### 1.4 Deploy to Vercel

1. Push the repo to GitHub/GitLab and import it in Vercel (framework auto-detects Next.js).
2. Set the **environment variables** (Production + Preview):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon **pooled** URL (`…-pooler…:6543/…?sslmode=require&connection_limit=1`) |
   | `DIRECT_DATABASE_URL` | Neon **direct** URL (`:5432`) — used if you run migrations from CI |
   | `ADMIN_PASSWORD` | **required** — 48+ chars, random |
   | `ADMIN_SECRET` | **required** — `openssl rand -hex 32` |
   | `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` (no trailing slash) |
   | `RESEND_API_KEY` | optional — enables real email (replies + password resets) |
   | `RESEND_FROM` / `CONTACT_REPLY_TO` | optional — sender/reply-to addresses |
   | `DONATE_PROVIDER_URL` | optional — real donation page instead of the demo |
   | `SOURCE_DOWNLOAD_PUBLIC` | optional — set `"true"` only if you want the footer's source-zip download (`/api/download`) open to everyone. Default in production: **admin session required** |

3. Deploy. One setting worth making explicit — set the **Build Command** to
   `pnpm db:setup && pnpm build` (Project → Settings → General → Build & Output):
   - it runs `prisma generate` + `prisma db push` **before** `next build`, so
     the gitignored Prisma client exists and the Neon schema is provisioned
     on the first deploy — exactly like the Netlify flow (§2.3).
   - the framework default (`next build` alone) relies on install hooks that
     warm dependency caches can skip — with the same outcome as the Netlify
     failure mode in the Troubleshooting table below.
   - the `build` script itself also runs `prisma generate` first, so plain
     `pnpm build` is covered even without the setting.

   The `build` script detects serverless hosts (`VERCEL`/`NETLIFY`) and skips
   the standalone packaging meant for self-hosting — they deploy the regular
   Next.js build output. API routes run on the Node.js runtime, which the
   `pg` driver requires.

   **No GitHub?** Deploy straight from a checkout with the Vercel CLI:
   `pnpm dlx vercel@latest login && pnpm dlx vercel@latest --prod` (still set
   the environment variables above — via the dashboard or
   `pnpm dlx vercel@latest env add`).

**Without `ADMIN_PASSWORD` + `ADMIN_SECRET` the admin dashboard refuses to
authenticate in production (fail closed)** — that's by design. The demo
password only works when `NODE_ENV !== "production"`.

### 1.5 Custom domain

Add the domain in Vercel → Settings → Domains. Update `NEXT_PUBLIC_SITE_URL`
to match, redeploy, then (optionally) submit the domain to
[hstspreload.org](https://hstspreload.org) — the app already sends HSTS with
`preload`.

---

## 2. Netlify (alternative host)

The same serverless + Neon architecture as §1, running on Netlify's runtime.
The repo ships a **`netlify.toml`** that wires up the official Next.js runtime
plugin (`@netlify/plugin-nextjs`), pins Node 22 and points the publish
directory at `.next` — Netlify picks up pnpm automatically via the
`packageManager` field in `package.json`.

### 2.1 Create the site

- **With Git (recommended):** push the repo to GitHub/GitLab, then in Netlify:
  *Add new site → Import an existing project*. All build settings come from
  `netlify.toml` — nothing to fill in.
- **Without Git, from a checkout:**

  ```bash
  pnpm dlx netlify-cli@latest login
  pnpm dlx netlify-cli@latest init          # create/link the site
  # environment variables — same table as §1.4, one per line:
  pnpm dlx netlify-cli@latest env:set DATABASE_URL "postgres://…-pooler…:6543/…?sslmode=require&connection_limit=1"
  pnpm dlx netlify-cli@latest env:set DIRECT_DATABASE_URL "postgres://…:5432/…?sslmode=require"
  pnpm dlx netlify-cli@latest env:set ADMIN_PASSWORD "…48+ chars…"
  pnpm dlx netlify-cli@latest env:set ADMIN_SECRET "…"
  pnpm dlx netlify-cli@latest env:set NEXT_PUBLIC_SITE_URL "https://yourdomain.com"
  pnpm dlx netlify-cli@latest deploy --build --prod
  ```

### 2.2 Environment variables

Exactly the same table as Vercel (§1.4) — `DATABASE_URL` on the **pooled**
Neon connection. Netlify exposes env vars to the entire build, so both the
`prisma generate` and `prisma db push` steps of `pnpm db:setup` see them. Set
them **before** the first deploy: the build fails closed without
`DATABASE_URL` (the sitemap generation touches the database).

`DIRECT_DATABASE_URL` is optional: when it's missing, the Neon direct host is
derived automatically from the pooled `DATABASE_URL` (strip `-pooler`, port
`5432`) — see `prisma.config.ts`.

Deploy previews inherit the same variables — point them at a separate Neon
branch if you want preview data isolated, but always keep the pooled URL.

### 2.3 Automatic schema provisioning

**The Netlify build generates the Prisma client and creates/updates the
database schema for you** — `netlify.toml` runs `pnpm db:setup` (→ `prisma
generate` + `prisma db push`, non-destructive) before `pnpm build` (which
re-runs `prisma generate`, idempotently). The generate step is essential:
`src/generated/prisma` is gitignored (fresh checkout = no client) and a warm
Netlify dependency cache makes `pnpm install` a no-op that skips
`postinstall`. A fresh Neon database gets its tables on the first deploy;
later deploys are a no-op unless the schema changed.

The step is deliberately **non-fatal**: if it can't reach the database the
build logs a loud warning and continues. The site then deploys, but every
database action fails — in that case open **Admin → System status banner**,
which shows the exact server error and the fix (or visit `/api` — it reports
`{"database":"down"}` on a 503). Seeding demo content is still manual
(`pnpm db:push && pnpm db:seed` from a checkout, §1.3) — you usually want to
import your own data anyway.

### 2.4 Netlify-specific notes

- `output: "standalone"` is skipped automatically on Netlify (`NETLIFY` is
  detected in `next.config.ts`) — the runtime builds its functions from the
  standard `.next` output. Self-hosting builds are unaffected.
- `GET /api/download` (source zip) returns **501 by design** — as on Vercel,
  the function bundle contains no source tree.
- In-memory rate limiters are per-function-instance — see
  [SECURITY.md](./SECURITY.md).
- Seeding: run once from a checkout against Neon (`pnpm db:push &&
  pnpm db:seed`, §1.3) if you want the demo content — the build itself only
  provisions the schema (§2.3).

---

## 3. Supabase (alternative database)

Works identically to Neon — Supabase is Postgres.

1. Create a project at [supabase.com](https://supabase.com).
2. Connection strings (Project Settings → Database):
   - **Transaction pooler** (port `6544`) → `DATABASE_URL`
   - **Session/direct** (port `5432`) → `DIRECT_DATABASE_URL`
3. Append `?sslmode=require` and (for the pooled URL) `&connection_limit=1`.
4. Follow the same steps as Vercel + Neon above (`db:push`,
   `db:seed`, deploy).

---

## 4. Railway / Render (single-instance hosting)

Single long-running instances are the simplest target — the in-memory rate
limiters and challenge nonces work exactly as designed.

- **Build command:** `pnpm install && pnpm build`  
  (Prisma 7 note: the CLI reads its URLs from `prisma.config.ts` — set
  `DIRECT_DATABASE_URL` there for migrations, `DATABASE_URL` (pooled) for the app)
- **Start command:** `pnpm start` — runs `.next/standalone/server.js`
  (`output: "standalone"` makes `next start` unsupported) and exports `.env`
  first when that file exists; honours `PORT` and `HOSTNAME` env vars
- **Env vars:** same table as Vercel (DATABASE_URL points at any Postgres —
  Railway/Render can provision one for you).
- Run `pnpm db:push` (or `db:migrate`) once against the production database
  before the first start, then `pnpm db:seed` if you want demo data.

---

## 5. Docker / self-hosting

The Next.js config uses `output: "standalone"`, so the build produces a
self-contained server:

```bash
pnpm install
pnpm build                  # produces .next/standalone (see note below)
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cd .next/standalone
DATABASE_URL=… ADMIN_PASSWORD=… ADMIN_SECRET=… NEXT_PUBLIC_SITE_URL=… \
  node server.js            # listens on PORT (default 3000)
```

> `DATABASE_URL` must point at a reachable PostgreSQL instance (Neon over the
> internet, or a Postgres container/service on the same host).

> The repo's `build` script performs the two `cp` steps automatically after
> `next build` (`scripts/postbuild.mjs` — skipped on the serverless hosts,
> which ignore the standalone output), and `pnpm start`
> (scripts/start-production.sh) does the `cd` + env-loading for you when a
> `.env` file is present. If you deploy to Vercel or Netlify instead, no
> override is needed — the build script detects both.

Minimal `Dockerfile` sketch:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/standalone/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Put a reverse proxy (Caddy/nginx) in front for TLS.

---

## 6. Production checklist

**Must do (the app enforces or assumes these):**

- [ ] `ADMIN_PASSWORD` (48+ chars) and `ADMIN_SECRET` (random) set — admin is
      disabled without them
- [ ] `DATABASE_URL` is a **postgres://** URL — the app is PostgreSQL-only and
      fails closed otherwise. Use the **pooled** URL (Neon `:6543` /
      Supabase `:6544`) — serverless functions otherwise exhaust connections;
      schema pushed; migrations under version control if you use them
- [ ] `NEXT_PUBLIC_SITE_URL` set to the public domain (emails, sitemap, OG)
- [ ] Secrets only in the platform's env settings — never in git (`.env` is
      gitignored; the shipped repo has no `.env` or database file)
- [ ] Password-reset + admin-reply emails: set `RESEND_API_KEY` (without it the
      app stays in dry-run mode and reset links are returned by the API — fine
      for demos, not for production)

**Should do (operational):**

- [ ] Uptime probe on `/api` (returns `{"status":"ok","database":"up"}`) — it
      reports 503 when the database is unreachable
- [ ] Skip the demo blog seed (`scripts/seed-blog.ts`) if you don't want the
      public demo accounts
- [ ] Review [SECURITY.md](./SECURITY.md) — especially the sections on
      distributed rate limiting and the donation confirmation endpoint
- [ ] Decide on the source-package endpoint (`GET /api/download`): leave it
      admin-gated (default) or set `SOURCE_DOWNLOAD_PUBLIC="true"`; remove
      the footer button in `src/components/app/footer.tsx` if you don't want
      it offered at all. **On Vercel/Netlify it returns 501 by design** — the
      serverless bundle contains no source tree (use the git repo or
      `pnpm package` from a checkout)
- [ ] Set up log retention/drain (Prisma query logging is disabled in
      production; only errors and warnings are printed)

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Admin sign-in says "disabled" | `ADMIN_PASSWORD`/`ADMIN_SECRET` missing in the deployed environment |
| Deploy succeeded, but every admin action fails (500) | The database has no schema or is unreachable — a plain `next build` never touches it. Check **Admin → System status banner** (exact error + fix), then look for the `[db-setup]` block in the deploy build log. On Netlify the build provisions the schema automatically (§2.3) — a failed sync is the usual culprit (bad URL or paused Neon project) |
| `P2021: table does not exist` | The schema was never pushed — redeploy (Netlify runs `pnpm db:setup`), or run `pnpm db:setup` from a checkout against your database |
| `P1001: Can't reach database` | `DATABASE_URL` wrong, or the Neon project is paused (free tier) — resume it and redeploy |
| Many `Timed out fetching a new connection` errors | You're using the **direct** (non-pooled) URL at runtime — switch `DATABASE_URL` to the pooled connection |
| Reset emails not arriving | No `RESEND_API_KEY` (dry-run) — check the server logs for `[email:dry-run]` |
| Cross-origin 403 on your own forms | The request reached the app through an unexpected proxy chain — check that `Sec-Fetch-Site` headers aren't stripped by your proxy, and see `isSameOrigin` in `src/lib/security.ts` |
| Prisma `did not initialize yet` on serverless | Ensure `prisma generate` runs during build — it does: `pnpm db:setup` runs it before `prisma db push`, and the `build` script runs it again before `next build` (v1.3.2+). Don't strip either |
| Netlify build fails: `Can't resolve '@/generated/prisma/client'` | The Prisma client wasn't generated: fresh checkouts have no `src/generated` (gitignored), Prisma 7's `db push` doesn't create it, and a **warm dependency cache** makes Netlify's install a no-op that skips `postinstall`. Fixed in v1.3.2 (`db:setup` + `build` both generate). Quick unblock without touching code: override the build command in the Netlify UI with `pnpm db:generate && pnpm db:setup && pnpm build` |
| `DATABASE_URL must be a postgres:// connection string` | The env var is missing or not a Postgres URL — this app is PostgreSQL-only. Set it to your Neon pooled URL (see §1.4) |
| Netlify deploy fails during `next build` | Usually a missing env var — the build fails closed without `DATABASE_URL` (the sitemap step touches the database). Set the §1.4 variables and redeploy. For plugin/runtime errors, check the build log — the shipped `netlify.toml` pins no plugin version, so the Next.js runtime always resolves its latest |
