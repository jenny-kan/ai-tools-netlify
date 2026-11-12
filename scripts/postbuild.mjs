#!/usr/bin/env node
/**
 * Post-build step: package the standalone output for self-hosting
 * (macOS launchd, Docker, Railway/Render bare `node server.js`, …).
 *
 * `output: "standalone"` in next.config.ts makes `next build` emit a
 * self-contained server, but it still needs the static assets and public/
 * copied in — that's what this does.
 *
 * On serverless hosts (Vercel: VERCEL=1, Netlify: NETLIFY=true) the step is
 * skipped: they deploy from the regular .next build output and ignore
 * .next/standalone entirely, so copying files into it would just waste
 * build time.
 */
import { cpSync, existsSync } from "node:fs";

if (process.env.VERCEL || process.env.NETLIFY) {
  console.log(`[postbuild] ${process.env.VERCEL ? "Vercel" : "Netlify"} build detected — skipping standalone packaging`);
  process.exit(0);
}

const standalone = ".next/standalone";
if (!existsSync(standalone)) {
  console.warn(
    "[postbuild] .next/standalone not found — nothing to package " +
      "(expected when output: 'standalone' is disabled in next.config.ts)",
  );
  process.exit(0);
}

cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
cpSync("public", `${standalone}/public`, { recursive: true });
console.log("[postbuild] standalone server packaged → .next/standalone (start it with: pnpm start)");
