import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration (replaces the old `package.json#prisma` key and the
 * deprecated `url`/`directUrl` fields in the schema's datasource block).
 *
 *  - Loads `.env` explicitly — Prisma 7 no longer auto-loads env vars.
 *  - `DIRECT_DATABASE_URL` (optional) is used for migrations when present —
 *    the standard Neon/Supabase setup (pooled runtime URL, direct URL for DDL).
 */

function resolveUrl(): string {
  // Migrations/CLI prefer the direct connection (Neon/Supabase, port 5432);
  // the pooled DATABASE_URL is what the app itself uses at runtime.
  const url = (process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL)?.trim();
  if (url?.startsWith("postgres")) return url;
  if (url) {
    const scheme = url.slice(0, url.indexOf(":") || url.length);
    throw new Error(
      `DATABASE_URL/DIRECT_DATABASE_URL must be a postgres:// connection string — ` +
        `this app is PostgreSQL-only (got "${scheme}://…"). See .env.example.`,
    );
  }
  // `prisma generate` doesn't connect, so a syntactically valid placeholder
  // keeps installs working before .env exists. Anything that DOES connect
  // (db push / migrate) fails loudly against it — set real URLs in .env.
  console.warn(
    "[prisma.config] No DATABASE_URL set — using a generate-only placeholder. " +
      "Set DATABASE_URL (and DIRECT_DATABASE_URL) in .env — see .env.example.",
  );
  return "postgres://placeholder:placeholder@localhost:5432/placeholder";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts && tsx scripts/seed-blog.ts",
  },
  datasource: {
    url: resolveUrl(),
  },
});
