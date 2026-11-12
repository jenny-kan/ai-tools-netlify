import { PrismaPg } from "@prisma/adapter-pg";
// Prisma 7: the client is generated into src/generated/prisma (see
// prisma/schema.prisma) instead of being imported from @prisma/client.
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 database access — PostgreSQL only (Neon in production, any local
 * Postgres in development). The Rust-free client requires a driver adapter:
 * @prisma/adapter-pg.
 *
 * DATABASE_URL should be the POOLED connection on serverless hosts
 * (Neon: host contains `-pooler`, port 6543, `?sslmode=require&connection_limit=1`)
 * — see .env.example / DEPLOYMENT.md.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    // Fail closed instead of silently defaulting — a loud, explained error
    // beats a cryptic 500 on every request.
    throw new Error(
      "DATABASE_URL is not set. It must be a PostgreSQL connection string " +
        "(postgres://…). Copy .env.example to .env and fill in the Neon URLs — see DEPLOYMENT.md.",
    );
  }
  if (!url.startsWith("postgres")) {
    const scheme = url.slice(0, url.indexOf(":") || url.length);
    throw new Error(
      `DATABASE_URL must be a postgres:// connection string — this app is PostgreSQL-only (got "${scheme}://…").`,
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
    // Query logging is a dev luxury — in production it would print every
    // bound parameter (emails, hashes, message bodies) into log drains.
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["query", "error", "warn"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
