# Running AI Tool Finder on a local Mac (macOS 10.15 Catalina)

Step-by-step guide to running this site on your own Mac at
`http://localhost:3000` — installed from the source zip, started at login,
with data that survives rebuilds and updates.

Everything below was verified against the exact package this guide ships in.
Versions used: **Node 22 LTS, pnpm 12, Prisma 7, Next.js 16**.

> **Native binaries vs. old macOS** — every darwin-x64 binary in this
> project's dependency tree was audited (Mach-O headers + full
> undefined-symbol scans): Tailwind's compiler needs macOS 10.12+,
> `@unrs/resolver` 10.12+, sharp only macOS-10-era APIs, and Prisma 7 is
> Rust-free (pure TS/WASM — no native engines at all; the app is
> PostgreSQL-only via the pure-JS `pg` driver, so there is no native
> database binding in the tree either). `esbuild` is pinned to **0.23.1**
> (built with Go 1.22 → runs on macOS 10.15+) because esbuild **0.27+** is
> built with Go 1.25, whose darwin binaries are linked against
> macOS-13-only symbols and abort on older systems with
> `dyld: Symbol not found: _SecTrustCopyCertificateChain` (0.26.0 is the
> last clean release). Next.js's native compiler (`@next/swc-darwin-x64`
> 16.4.6) declares no minimum macOS and its symbol table only references
> macOS-10-era APIs — it is expected to load on 10.15 (self-test and WASM
> safety net in Section 6).

---

## 0. Before you start — Catalina reality check

- Any Mac running 10.15 is Intel-based; every tool here uses official
  Intel (`darwin-x64`) builds. Nothing needs to be compiled by hand.
- **Homebrew is not an option** — it no longer supports macOS 10.15. Use
  `nvm` (below), which installs official Node.js builds that still support
  10.15 through the 22.x line.
- macOS 10.15 has not received security updates since 2022. Running this on
  your LAN or localhost is fine; **do not port-forward it to the internet**.
- Browsers on 10.15 are old. The site targets modern browsers — use the
  newest Chrome or Firefox that still runs on Catalina, or simply open the
  site from a newer device on your network (Section 6, "From another
  device"). Safari 13 is not a supported target.
- First build needs ~1.5 GB of free RAM and a few minutes. Close big apps
  if your Mac has 4 GB.

## 1. Install Node.js 22 LTS via nvm

Prisma 7 requires Node `≥ 20.19` (or `≥ 22.12`); Next.js 16 requires
`≥ 20.9`. Node 22 LTS satisfies everything and still supports 10.15.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# close and reopen Terminal (or: source ~/.zshrc)
nvm install 22
nvm alias default 22
node -v        # must be v22.12 or newer
```

## 2. Enable pnpm

The project pins pnpm (`packageManager` field). Either:

```bash
corepack enable && corepack prepare pnpm@12.18.0 --activate
```

or, if Corepack misbehaves:

```bash
npm install -g pnpm@12.18.0
```

## 3. Put the project in a permanent place

1. On any machine, open the site's footer → **Download source package**
   (or copy an existing checkout).
2. Move the zip to the Mac (AirDrop / USB / Safari) and double-click it.
3. Put the folder somewhere permanent, e.g. your home folder:

```bash
mv ~/Downloads/ai-tool-finder ~/ai-tool-finder
cd ~/ai-tool-finder
```

Don't leave it in `~/Downloads` — the auto-start configuration in Section 7
bakes in the folder path, and Downloads gets cleaned up by some tools.

> Files extracted from a browser-downloaded zip may carry macOS quarantine
> attributes. That's harmless here (all native code is installed fresh by
> pnpm in the next step), but if macOS ever complains:
> `xattr -dr com.apple.quarantine ~/ai-tool-finder`

## 4. Configure `.env` — the database

The app is **PostgreSQL-only** — the Mac runs the site, the data lives in
a Postgres database. The easiest (and recommended) option is a free
[Neon](https://neon.tech) project; a local Postgres works too if you
prefer, but nothing in this project needs one.

```bash
cd ~/ai-tool-finder
cp .env.example .env
open -e .env
```

Set **two** connection strings (Neon's dashboard shows both — Connection
Details → allow list your IP or enable all):

```bash
DATABASE_URL="postgres://…-pooler…neon.tech:6543/neondb?sslmode=require&connection_limit=1"
DIRECT_DATABASE_URL="postgres://…neon.tech:5432/neondb?sslmode=require"
```

- `DATABASE_URL` — the **pooled** connection (host contains `-pooler`,
  port 6543); the app uses it at runtime.
- `DIRECT_DATABASE_URL` — the **direct** connection (port 5432);
  `pnpm db:push` / migrations use it (pooled connections can't run DDL).

There is no database file on the Mac — your data lives in Postgres, so it
survives rebuilds and updates by design.

While you're in there, set the admin credentials (required in production —
the dashboard refuses to work without them):

```bash
ADMIN_PASSWORD="at-least-48-characters-long-passphrase-here-xxxxxxxxxx"
ADMIN_SECRET="paste-output-of-openssl-rand-hex-32"
```

Generate the secret with `openssl rand -hex 32` (works on macOS as-is).

Optional, for access from other devices on your network — uncomment:

```bash
HOSTNAME="0.0.0.0"
```

## 5. Install dependencies and create the database

```bash
pnpm install        # ~1–3 min (pure-JS database driver — no native DB binary)
pnpm db:push        # creates the tables in Postgres over DIRECT_DATABASE_URL
pnpm db:seed        # optional: 81 tools + demo blog content (idempotent)
```

No compiler is ever needed for the database — the `pg` driver is pure
JavaScript. (If you ever see a compile prompt for something else, `xcode-select --install` once — Command Line Tools 12.4 is the last version
for Catalina and is sufficient.)

> If a previous `pnpm install` on an older copy of this project died with
> `ERR_PNPM_EXECUTOR_LIFECYCLE_SCRIPT_FAILED` (esbuild / dyld), just
> re-run `pnpm install` after updating — the esbuild pin ships in
> `pnpm-workspace.yaml` + `pnpm-lock.yaml`. No need to delete `node_modules`.

## 6. Build and start (production mode)

```bash
pnpm build          # a few minutes; produces .next/standalone
pnpm start          # → http://localhost:3000
```

> **macOS 10.15 note** — `@next/swc-darwin-x64` 16.4.6 was audited for
> Catalina (Mach-O headers plus a scan of every undefined symbol): it
> declares no minimum macOS version, uses classic dyld fixups, and only
> references APIs that have existed since the macOS 10 era — so it is
> expected to load on 10.15. Quick self-test after `pnpm install`:
>
> ```bash
> node -e "require('@next/swc-darwin-x64"); console.log('SWC loads — build works')"
> ```
>
> If it unexpectedly fails to load on your machine: Next automatically
> downloads a pure-WASM compiler fallback, but that supports only the
> webpack bundler — build with `pnpm build --webpack` in that case
> (Turbopack, the default, needs the native compiler). Either way, the
> produced standalone server is plain JavaScript and runs on 10.15.

- `pnpm start` runs the standalone server (`.next/standalone/server.js`)
  and loads your `.env` first. Stop it with `Ctrl-C`.
- Different port: `PORT=8080 pnpm start`.
- Verify it's healthy: open `http://localhost:3000/api` — you should see
  `{"status":"ok","database":"up"}`.
- Sign in to the dashboard at `/admin` with your `ADMIN_PASSWORD`.

**Firewall prompt** — the first time, macOS asks
*"Do you want the application Node.js to accept incoming network
connections?"* Click **Allow** if you want LAN access, or **Deny** for
localhost-only use (the site keeps working either way on this Mac).

**From another device** — with `HOSTNAME="0.0.0.0"` in `.env` and the
firewall allowed, find your Mac's address (System Preferences → Network, or
`ipconfig getifaddr en0`) and open `http://<that-address>:3000` from any
device on the same Wi-Fi.

> Just hacking on the code? `pnpm dev` gives you a hot-reloading dev server
> on port 3000 instead.

## 7. Start automatically at login (launchd)

First, make Node visible to non-interactive shells (one-time):

```bash
grep -q NVM_DIR ~/.zprofile 2>/dev/null || cat >> ~/.zprofile <<'EOF'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
EOF
```

Then create the LaunchAgent — replace **both** `YOUR-NAME` occurrences:

```bash
mkdir -p ~/Library/LaunchAgents ~/Library/Logs
cat > ~/Library/LaunchAgents/com.aitoolfinder.web.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.aitoolfinder.web</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>sh /Users/YOUR-NAME/ai-tool-finder/scripts/start-production.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/YOUR-NAME/Library/Logs/aitoolfinder.out.log</string>
  <key>StandardErrorPath</key><string>/Users/YOUR-NAME/Library/Logs/aitoolfinder.err.log</string>
</dict>
</plist>
EOF
```

Activate it:

```bash
launchctl load -w ~/Library/LaunchAgents/com.aitoolfinder.web.plist
```

- The site now starts at login and restarts automatically after a crash.
- Logs: `~/Library/Logs/aitoolfinder.out.log` and `.err.log`
  (`tail -f ~/Library/Logs/aitoolfinder.err.log`).
- Stop until next login: `launchctl unload -w ~/Library/LaunchAgents/com.aitoolfinder.web.plist`
- Restart it (e.g. after an update): `launchctl kickstart -k gui/$(id -u)/com.aitoolfinder.web`

## 8. Updating to a newer version

Replace the source while keeping your config and data. Unzip to a temp
folder first (unzipping over a live folder merges old and new files), and
stop the running site so the database is quiet during the copy:

```bash
launchctl unload -w ~/Library/LaunchAgents/com.aitoolfinder.web.plist  # stop (skip if not installed)

cd /tmp && rm -rf aitf-update && mkdir aitf-update && cd aitf-update
unzip ~/Downloads/ai-tool-finder-1.x.x.zip        # → ./ai-tool-finder
cp ~/ai-tool-finder/.env ai-tool-finder/.env                  # your config
rm -rf ~/ai-tool-finder && mv ai-tool-finder ~/ai-tool-finder

cd ~/ai-tool-finder
pnpm install --frozen-lockfile
pnpm db:push          # apply any schema changes
pnpm build

launchctl load -w ~/Library/LaunchAgents/com.aitoolfinder.web.plist   # start again
```

Your content (tools you edited, blog posts, messages, analytics) lives in
your Postgres database — nothing to copy but `.env`.

## 9. Backups

Your data lives in Postgres, so backups happen at the database, not on
the Mac:

- **Neon** keeps a 7-day restore window on the free plan (History /
  Restore) and can create a branch as an instant snapshot.
- Any Postgres: `pg_dump` on a schedule works, e.g.
  `pg_dump "$DIRECT_DATABASE_URL" -Fc -f ~/backups/aitf-$(date +%F).dump`
  (install a `pg_dump` client from postgresapp.com if you don't have one).

Time Machine on the Mac still covers `.env` and the project folder.

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `EADDRINUSE :::3000` | Something else uses port 3000: `lsof -i :3000`, then `kill <pid>` — or run on another port (`PORT=8080 pnpm start`) |
| `P1001: Can't reach database` on startup | `DATABASE_URL`/`DIRECT_DATABASE_URL` wrong, or your IP isn't in Neon's allow list (Neon dashboard → Connection Details), or you forgot `pnpm db:push` |
| `pnpm install` aborts with `dyld: Symbol not found: _SecTrustCopyCertificateChain` (esbuild postinstall, `ERR_PNPM_EXECUTOR_LIFECYCLE_SCRIPT_FAILED`) | Your copy predates the esbuild 0.23.1 pin — esbuild 0.27+ darwin binaries are linked against macOS-13-only symbols and abort on macOS 12 and older. Update to the current source package (Section 8), or add `overrides: { esbuild: 0.23.1 }` to `pnpm-workspace.yaml` and re-run `pnpm install`. Do **not** try to skip the script — the binary would fail again when `pnpm db:seed` runs |
| `pnpm build` / `pnpm dev` can't load `@next/swc-darwin-x64` on macOS 10.15 | Should not happen — the binary declares no version floor and references no post-10.15 APIs (audited). If it does: the automatic WASM fallback supports webpack builds, so run `pnpm build --webpack`; the standalone server runs on 10.15 regardless |
| Admin sign-in says "disabled" | `.env` lacks `ADMIN_PASSWORD` (48+ chars) / `ADMIN_SECRET` — add them and restart (`launchctl kickstart -k …`) |
| `DATABASE_URL must be a postgres:// connection string` | Expected env var missing or not a Postgres URL — the app is PostgreSQL-only; see Section 4 |
| Can't reach the site from another device | `HOSTNAME="0.0.0.0"` must be in `.env`; allow Node in the firewall; both devices on the same network |
| Site won't start at login | `tail ~/Library/Logs/aitoolfinder.err.log`; most common cause: `~/.zprofile` missing the nvm lines (Section 7) |
| `node: command not found` in launchd logs | Redo the `~/.zprofile` step in Section 7, then `launchctl kickstart -k gui/$(id -u)/com.aitoolfinder.web` |
| Password-reset / contact emails never arrive | No `RESEND_API_KEY` configured — the app runs in dry-run mode and prints emails to the log instead |

---

*For cloud deployments (Netlify/Vercel + Neon, Supabase, Railway/Render,
Docker) see [DEPLOYMENT.md](./DEPLOYMENT.md). Security notes:
[SECURITY.md](./SECURITY.md).*
