import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * Admin: deployment diagnostics — is the database reachable, is the schema
 * provisioned, and what's in it. Powers the status banner in the dashboard.
 *
 * Rationale: on serverless hosts a fresh deploy can succeed with a broken or
 * empty database (nothing in the build touches the DB). The first sign of
 * trouble is then every admin action failing with "Request failed (500)".
 * This endpoint names the problem precisely instead.
 */

/** Core tables — missing any of them means `prisma db push` never ran. */
const CORE_TABLES = ["Category", "Tool", "BlogPost", "AuditLog"] as const;

interface SystemStatusResponse {
  database: {
    connected: boolean;
    schemaReady: boolean;
    missingTables: string[];
    error: string | null;
    counts: { tools: number; published: number; categories: number } | null;
  };
  environment: {
    node: string;
    host: "netlify" | "vercel" | "self-hosted";
  };
  time: string;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return unauthorized();

  const status: SystemStatusResponse = {
    database: {
      connected: false,
      schemaReady: false,
      missingTables: [],
      error: null,
      counts: null,
    },
    environment: {
      node: process.version,
      host: process.env.NETLIFY ? "netlify" : process.env.VERCEL ? "vercel" : "self-hosted",
    },
    time: new Date().toISOString(),
  };

  // 1) Reachability — same probe as the public /api health check.
  try {
    await db.$queryRaw`SELECT 1`;
    status.database.connected = true;
  } catch (e) {
    status.database.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(status);
  }

  // 2) Schema — list the tables that actually exist.
  try {
    const rows = await db.$queryRaw<
      Array<{ tableName: string }>
    >`SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = 'public'`;
    const have = new Set(rows.map((r) => r.tableName));
    status.database.missingTables = CORE_TABLES.filter((t) => !have.has(t));
    status.database.schemaReady = status.database.missingTables.length === 0;
  } catch (e) {
    status.database.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(status);
  }

  // 3) Content counts (only when the schema is there).
  if (status.database.schemaReady) {
    try {
      const tools = await db.tool.count();
      const published = await db.tool.count({ where: { status: "PUBLISHED" } });
      const categories = await db.category.count();
      status.database.counts = { tools, published, categories };
    } catch (e) {
      status.database.error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(status);
}
