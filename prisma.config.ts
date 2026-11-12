import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration (replaces the old `package.json#prisma` key and the
 * deprecated `url`/`directUrl` fields in the schema's datasource block).
 *
 *  - Loads `.env` explicitly — Prisma 7 no longer auto-loads env vars.
 *  - `DIRECT_DATABASE_URL` (optional) is used for migrations when present —
 *    the standard Neon/Supabase setup (pooled runtime URL, direct URL for DDL).
 *  - When only the pooled `DATABASE_URL` is set, the direct URL is derived
 *    automatically for Neon (see `deriveNeonDirectUrl`).
 */

/**
 * Neon's pooled host is `<endpoint>-pooler.<region>.aws.neon.tech` (:6543,
 * PgBouncer); the direct host is `<endpoint>.<region>.aws.neon.tech` (:5432).
 * DDL (prisma db push / migrate) should run over the direct connection.
 * Non-Neon URLs are returned unchanged (set DIRECT_DATABASE_URL for others).
 */
export function deriveNeonDirectUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("-pooler.")) return url;
    u.hostname = u.hostname.replace("-pooler.", ".");
    u.port = u.port === "" ? "5432" : u.port === "6543" ? "5432" : u.port;
    return u.toString();
  } catch {
    return url;
  }
}

/** Hostname only, for logs — never log credentials. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "(unparseable URL)";
  }
}

function resolveUrl(): string {
  // Migrations/CLI prefer the direct connection (Neon/Supabase, port 5432);
  // the pooled DATABASE_URL is what the app itself uses at runtime.
  const direct = process.env.DIRECT_DATABASE_URL?.trim();
  if (direct?.startsWith("postgres")) return direct;

  const pooled = process.env.DATABASE_URL?.trim();
  if (pooled?.startsWith("postgres")) {
    const derived = deriveNeonDirectUrl(pooled);
    if (derived !== pooled) {
      console.log(
        `[prisma.config] DIRECT_DATABASE_URL not set — derived the Neon direct host ${hostOf(derived)} from the pooled DATABASE_URL for DDL.`,
      );
    }
    return derived;
  }

  if (direct || pooled) {
    const url = (direct ?? pooled)!;
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
