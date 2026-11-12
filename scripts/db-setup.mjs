#!/usr/bin/env node
/**
 * Deploy-time provisioning, run BEFORE the Next.js build:
 *
 *   node scripts/db-setup.mjs        (also wired up as `pnpm db:setup`)
 *
 * Step 1 — `prisma generate` (ALWAYS runs, offline, FATAL on failure):
 *   Prisma 7 generates the client into `src/generated/prisma`, which is
 *   gitignored on purpose — a fresh CI checkout starts WITHOUT it, and unlike
 *   Prisma ≤6 the `db push` command no longer generates it. Hosting platforms
 *   with a warm dependency cache skip `pnpm install` entirely (Netlify logs
 *   "Already up to date" in ~16ms), which also skips the `postinstall` hook —
 *   so the ONLY reliable place to generate is the explicit build chain.
 *   Without the client `next build` dies with:
 *     Module not found: Can't resolve '@/generated/prisma/client'
 *   `generate` needs no database, so it runs even when no URL is configured.
 *
 * Step 2 — `prisma db push` (needs a URL, NON-FATAL on failure):
 *   On serverless hosts a deploy can otherwise succeed with an EMPTY
 *   database — nothing in `next build` needs tables. The site then deploys
 *   "successfully" while every admin action fails with a 500 (fresh Neon
 *   database, schema never created). Pushing here creates the schema on the
 *   first deploy and keeps it in sync afterwards. A failed push logs a loud
 *   warning and the build continues — a deploy must never brick over a
 *   transient database hiccup. The admin dashboard's "System status" banner
 *   surfaces the same problem at runtime with exact fix instructions.
 *
 * The CLI resolves the target via prisma.config.ts:
 *   DIRECT_DATABASE_URL (direct :5432)  →  used as-is
 *   else DATABASE_URL (Neon pooled)     →  direct host derived automatically
 */
import { spawnSync } from "node:child_process";
// Same loading convention as prisma.config.ts — never overrides real env vars
// (on Netlify the variables come from the environment, not a .env file).
import "dotenv/config";

const isCi = Boolean(process.env.NETLIFY || process.env.VERCEL || process.env.CI);

function log(msg) {
  console.log(`[db-setup] ${msg}`);
}

function run(cmd) {
  // `prisma` resolves from node_modules/.bin — the script always runs in the
  // context of a package-manager script (pnpm/bun put .bin on PATH).
  return spawnSync(cmd, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });
}

function main() {
  // ---------------------------------------------------------------- step 1
  // Generate the Prisma client (offline — works without any DATABASE_URL).
  // FATAL on failure: `next build` cannot resolve "@/generated/prisma/client"
  // without it, and failing here with an explained error beats a cryptic
  // module-not-found three lines later.
  log("Generating the Prisma client (prisma generate)…");
  const gen = run("prisma generate");
  if (gen.error || gen.status !== 0) {
    log("──────────────────────────────────────────────────────────────────────────────");
    log("✖ prisma generate FAILED" +
      (gen.error ? ` (${gen.error.message})` : ` (exit ${gen.status})`) +
      " — the build cannot continue.");
    log("  src/generated/prisma is gitignored and must be regenerated on every CI");
    log("  checkout (Prisma 7; `db push` no longer does it, and a warm dependency");
    log("  cache skips the postinstall hook). Fix the error above and redeploy.");
    log("──────────────────────────────────────────────────────────────────────────────");
    process.exit(1);
  }
  log("✔ Prisma client generated into src/generated/prisma.");

  // ---------------------------------------------------------------- step 2
  // Whitespace-only values count as unset (an empty DIRECT_DATABASE_URL must
  // not shadow the pooled DATABASE_URL).
  const direct = (process.env.DIRECT_DATABASE_URL ?? "").trim();
  const pooled = (process.env.DATABASE_URL ?? "").trim();
  const hasUrl = direct.startsWith("postgres") || pooled.startsWith("postgres");

  if (!hasUrl) {
    if (isCi) {
      log("⚠ DATABASE_URL is not set — skipping schema sync. The deploy will come up");
      log("  with a broken/empty database. Set DATABASE_URL (Neon pooled URL) in your");
      log("  hosting environment variables and redeploy. See DEPLOYMENT.md.");
    } else {
      log("No DATABASE_URL configured — skipping (local development without a database).");
    }
    return;
  }

  log("Syncing the database schema (prisma db push, non-destructive)…");
  const result = run("prisma db push");

  if (result.error) {
    log(`⚠ Could not run prisma (${result.error.message}). Continuing the build.`);
    return;
  }
  if (result.status === 0) {
    log("✔ Database schema is in sync.");
    return;
  }

  log("──────────────────────────────────────────────────────────────────────────────");
  log("⚠ prisma db push FAILED (exit " + result.status + ") — the build continues, but the");
  log("  database schema may be missing or outdated. If it is, the site will deploy");
  log("  and then fail on every database action (admin tools show the exact error).");
  log("  Common causes:");
  log("    • Wrong DATABASE_URL / DIRECT_DATABASE_URL — copy both from the Neon");
  log("      dashboard (DEPLOYMENT.md §1).");
  log("    • Neon database paused (free tier) — resume it in the Neon console.");
  log("    • Destructive schema change refused — prisma db push never drops data;");
  log("      resolve manually from a checkout with `pnpm db:push`.");
  log("──────────────────────────────────────────────────────────────────────────────");
}

main();
