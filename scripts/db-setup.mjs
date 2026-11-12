#!/usr/bin/env node
/**
 * Deploy-time database provisioning: `prisma db push` against the production
 * database before the Next.js build.
 *
 *   node scripts/db-setup.mjs        (also wired up as `pnpm db:setup`)
 *
 * Why: on serverless hosts a deploy can succeed with an EMPTY database —
 * nothing in `next build` needs tables. The site then deploys "successfully"
 * while every admin action fails with a 500 (fresh Neon database, schema
 * never created). Running this in the build closes that gap: the schema is
 * created on the first deploy and kept in sync afterwards.
 *
 * Failure policy: NON-FATAL by design. A failed push logs a loud warning and
 * the build continues — a deploy must never brick over a transient database
 * hiccup. The admin dashboard's "System status" banner surfaces the same
 * problem at runtime with exact fix instructions.
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

function main() {
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
  // `prisma` resolves from node_modules/.bin — the script always runs in the
  // context of a package-manager script (pnpm/bun put .bin on PATH).
  const result = spawnSync("prisma db push", {
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });

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
