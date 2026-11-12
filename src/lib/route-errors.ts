import { NextResponse } from "next/server";

/**
 * Consistent 500 responses for route handlers.
 *
 * Unhandled errors in a route handler surface to the browser as an opaque
 * "Request failed (500)" toast — useless when diagnosing a broken deploy
 * (the classic case: the database was never provisioned). This helper
 * returns the real error message to the admin UI and keeps the details in
 * the server logs.
 */

/** Prisma "P2021/P2022" → the schema is missing tables/columns. */
function schemaHint(message: string): string {
  if (/\bP2021\b|does not exist in the current database/i.test(message)) {
    return " — the database schema is missing. Initialize it (redeploy, or run `pnpm db:setup` against your database).";
  }
  if (/\bP2022\b|column .* does not exist/i.test(message)) {
    return " — the database schema is out of date. Re-run `pnpm db:setup` (or `prisma db push`) to sync it.";
  }
  return "";
}

/** 500 JSON with the actual error message (plus hint when Prisma flags a schema problem). */
export function serverError(action: string, e: unknown): NextResponse {
  const raw = e instanceof Error ? e.message : String(e);
  const code =
    typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string"
      ? ` [${(e as { code: string }).code}]`
      : "";
  console.error(`[${action}]`, e);
  return NextResponse.json({ error: `${action} failed: ${raw}${code}${schemaHint(raw + code)}` }, { status: 500 });
}
