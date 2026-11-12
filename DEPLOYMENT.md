# Deploying ai-tools-central

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
   | `SOURCE_DOWNLOAD_PUBLIC` | optional — set `"true"` to open the source-zip endpoint (`GET /api/download`, not linked in the public UI anymore) to everyone. Default in production: **admin session required** |

3. Deploy. Nothing else to configure:
   - The default `build` script starts with `prisma generate`, so the Prisma 7
     client (gitignored under `src/generated/prisma`) is always created in CI
     before `next build` — even on a cold checkout. For extra safety you can
     set Vercel's build command to `pnpm db:setup && pnpm build` (same chain as
     Netlify): `db:setup` also pushes the schema to Neon (non-fatal).
   - The build script detects serverless hosts (`VERCEL`/`NETLIFY`) and
     skips the standalone packaging meant for self-hosting — they deploy the
     regular Next.js build output.
   - API routes run on the Node.js runtime, which the `pg` driver requires.

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

> **Every failure this Netlify path produced — and its fix — is chronicled in
> [NETLIFY-DEPLOYMENT-LESSONS.md](./NETLIFY-DEPLOYMENT-LESSONS.md).** Read it
> before changing the build chain.

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
Neon connection. Set them **before** the first deploy: the build fails closed
without `DATABASE_URL` (the sitemap generation touches the database).

> **Do not count on `postinstall`.** Netlify caches `node_modules` between
> builds; when the cache is warm, `pnpm install` is a ~16 ms no-op and the
> `postinstall` hook never runs. That is why the shipped `netlify.toml` runs
> `pnpm db:setup && pnpm build` — generation and schema push live in the
> explicit build chain, not in install hooks (see §2.3).

Deploy previews inherit the same variables — point them at a separate Neon
branch if you want preview data isolated, but always keep the pooled URL.

### 2.3 Netlify-specific notes

- **The build command is `pnpm db:setup && pnpm build`** (wired in
  `netlify.toml`). Two things make this chain necessary with Prisma 7:
  1. The generated client (`src/generated/prisma`) is gitignored — a cold
     checkout starts without it, and `next build` then fails on
     `Module not found: Can't resolve '@/generated/prisma/client'`.
  2. Netlify's dependency cache turns `pnpm install` into a no-op when warm,
     so `postinstall` (which would run `prisma generate`) is skipped.

  `pnpm db:setup` (`scripts/db-setup.mjs`) therefore runs **`prisma generate`
  explicitly (fatal on failure — the client must exist before `next build`)**
  and then **`prisma db push` (non-fatal — a transient DB error must not brick
  the deploy; the admin dashboard surfaces a System status banner at runtime
  if the database is unreachable)**. The `build` script repeats `prisma
  generate` as belt-and-braces so it also works standalone on other hosts.
- `output: "standalone"` is skipped automatically on Netlify (`NETLIFY` is
  detected in `next.config.ts`) — the runtime builds its functions from the
  standard `.next` output. Self-hosting builds are unaffected.
- `GET /api/download` (source zip) returns **501 by design** — as on Vercel,
  the function bundle contains no source tree.
- In-memory rate limiters are per-function-instance — see
  [SECURITY.md](./SECURITY.md).
- Seeding: run once from a checkout against Neon (`pnpm db:push &&
  pnpm db:seed`, §1.3) — Netlify doesn't run database migrations on deploy.
  An **empty Neon database** (schema never pushed) is why a fresh deploy can
  look "up" while every admin write returns 500 — push the schema first.

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
      admin-gated (default) or set `SOURCE_DOWNLOAD_PUBLIC="true"`. The
      public footer no longer links to it (buttons removed). **On
      Vercel/Netlify it returns 501 by design** — the
      serverless bundle contains no source tree (use the git repo or
      `pnpm package` from a checkout)
- [ ] Set up log retention/drain (Prisma query logging is disabled in
      production; only errors and warnings are printed)

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Admin sign-in says "disabled" | `ADMIN_PASSWORD`/`ADMIN_SECRET` missing in the deployed environment |
| `P1001: Can't reach database` | `DATABASE_URL` wrong, or you forgot `pnpm db:push` |
| Many `Timed out fetching a new connection` errors | You're using the **direct** (non-pooled) URL at runtime — switch `DATABASE_URL` to the pooled connection |
| Reset emails not arriving | No `RESEND_API_KEY` (dry-run) — check the server logs for `[email:dry-run]` |
| Cross-origin 403 on your own forms | The request reached the app through an unexpected proxy chain — check that `Sec-Fetch-Site` headers aren't stripped by your proxy, and see `isSameOrigin` in `src/lib/security.ts` |
| Prisma `did not initialize yet` on serverless | Ensure `prisma generate` runs during build (it does — the `postinstall` script runs it; don't skip it) |
| `DATABASE_URL must be a postgres:// connection string` | The env var is missing or not a Postgres URL — this app is PostgreSQL-only. Set it to your Neon pooled URL (see §1.4) |
| `Module not found: Can't resolve '@/generated/prisma/client'` (build) | Cold checkout has no generated Prisma 7 client (it's gitignored) and the install hook was skipped by Netlify's dependency cache. The shipped `netlify.toml` already runs `pnpm db:setup && pnpm build` — if you overrode the build command in the UI, set it back (or use `pnpm db:generate && pnpm db:setup && pnpm build`) |
| Netlify deploy fails during `next build` | Usually a missing env var — the build fails closed without `DATABASE_URL` (the sitemap step touches the database). Set the §1.4 variables and redeploy. For plugin/runtime errors, check the build log — the shipped `netlify.toml` pins no plugin version, so the Next.js runtime always resolves its latest |
| Dev server loads but nothing is clickable (stuck "Loading catalog…", no console errors) | The Next 16 dev server rejects the HMR WebSocket for origins other than `localhost` (e.g. `127.0.0.1` or a preview proxy), and a failed HMR socket stalls dev hydration SILENTLY. Open dev via `http://localhost:3000` (not the IP) and keep proxy origins in `allowedDevOrigins` (next.config.ts). Production builds are unaffected |
