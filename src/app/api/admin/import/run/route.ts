import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { ImportParseError, MAX_IMPORT_ROWS, runToolImport, validateImportOptions } from "@/lib/import-parser";
import { forbiddenOrigin, getClientIp, isSameOrigin, logAudit, rateLimit, sanitizeText } from "@/lib/security";
import { IMPORT_FIELDS } from "@/lib/types";
import type { ImportFieldKey, ImportRunRequestDTO } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Admin: validate (dryRun) or execute a bulk tool import.
 * Body: { rows, mapping, options, dryRun }.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return unauthorized();

  // Bulk-import security: origin check + rate limit + audit.
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const ip = getClientIp(req);
  const limited = rateLimit(`import-run:${ip}`, 15, 10 * 60 * 1000);
  if (!limited.ok) {
    logAudit("import.run.rateLimited", { actorType: "admin", ip });
    return NextResponse.json(
      { error: `Too many imports — wait ${Math.ceil(limited.retryAfterSec! / 60)} min.` },
      { status: 429 }
    );
  }

  const raw: unknown = await req.json().catch(() => null);
  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const body = raw as Partial<ImportRunRequestDTO>;

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }
  if (body.rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `Too many rows — imports are capped at ${MAX_IMPORT_ROWS} per batch.` },
      { status: 400 }
    );
  }
  if (body.rows.some((r) => typeof r !== "object" || r === null || Array.isArray(r))) {
    return NextResponse.json({ error: "Rows must be objects keyed by column header." }, { status: 400 });
  }

  if (typeof body.mapping !== "object" || body.mapping === null) {
    return NextResponse.json({ error: "Missing column mapping." }, { status: 400 });
  }
  // Keep only known fields whose header actually exists in the rows.
  const sampleKeys = new Set(body.rows.flatMap((r) => Object.keys(r as object)).slice(0, 5000));
  const mapping: Partial<Record<ImportFieldKey, string>> = {};
  for (const field of IMPORT_FIELDS) {
    const header = body.mapping[field];
    if (typeof header === "string" && sampleKeys.has(header)) {
      mapping[field] = header;
    }
  }

  const options = validateImportOptions(body.options);
  if ("error" in options) {
    return NextResponse.json({ error: options.error }, { status: 400 });
  }

  const rows = body.rows.map((r) => {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
      // Sanitize every cell: strip control/zero-width characters and cap the
      // length so a hostile import file can't poison logs or the catalog.
      const rawValue = typeof v === "string" ? v : v == null ? "" : String(v);
      row[k.slice(0, 100)] = sanitizeText(rawValue).slice(0, 10_000);
    }
    return row;
  });

  logAudit(`import.run${body.dryRun === true ? ".dry" : ""}`, {
    actorType: "admin",
    details: `${rows.length} rows`,
    ip,
  });

  try {
    const result = await runToolImport({
      rows,
      mapping,
      options,
      dryRun: body.dryRun === true,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ImportParseError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("import/run failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "The import failed unexpectedly." },
      { status: 500 }
    );
  }
}
