import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import {
  ImportParseError,
  MAX_IMPORT_BYTES,
  autoMapColumns,
  parseDelimited,
  parseJsonImport,
  readSqliteRows,
  readSqliteTables,
} from "@/lib/import-parser";
import { forbiddenOrigin, getClientIp, isSameOrigin, logAudit, rateLimit } from "@/lib/security";
import type { ImportFormat, ParseImportResponse } from "@/lib/types";

export const runtime = "nodejs";

/** Every SQLite file starts with this 16-byte magic string. */
const SQLITE_MAGIC = "SQLite format 3\u0000";

function sniffFormatFromName(name: string): ImportFormat | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv") return "csv";
  if (ext === "tsv" || ext === "tab") return "tsv";
  if (ext === "json") return "json";
  if (ext === "db" || ext === "sqlite" || ext === "sqlite3" || ext === "db3") return "sqlite";
  return null;
}

function sniffFormatFromText(text: string): ImportFormat {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  if (firstLine.includes("\t") && !firstLine.includes(",")) return "tsv";
  return "csv";
}

function isImportFormat(v: string): v is ImportFormat {
  return ["csv", "tsv", "json", "sqlite"].includes(v);
}

/**
 * Admin: parse an uploaded/pasted bulk-import source into raw rows.
 * Multipart body: file, format?, table? (for SQLite).
 * JSON body: { text, format }.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return unauthorized();

  // Bulk-import security: CSRF origin check + per-IP rate limit + audit.
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const ip = getClientIp(req);
  const limited = rateLimit(`import-parse:${ip}`, 30, 10 * 60 * 1000);
  if (!limited.ok) {
    logAudit("import.parse.rateLimited", { actorType: "admin", ip });
    return NextResponse.json(
      { error: `Too many parse requests — wait ${Math.ceil(limited.retryAfterSec! / 60)} min.` },
      { status: 429 }
    );
  }
  logAudit("import.parse", { actorType: "admin", ip });

  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const formatRaw = (form.get("format") as string | null)?.trim() ?? "";
      const table = ((form.get("table") as string | null) ?? "").trim();

      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
      }
      if (file.size > MAX_IMPORT_BYTES) {
        return NextResponse.json(
          { error: `The file is too large — keep imports under ${MAX_IMPORT_BYTES / 1024 / 1024} MB.` },
          { status: 413 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const isSqliteFile = buffer.subarray(0, 16).toString("latin1") === SQLITE_MAGIC;
      const format: ImportFormat = isSqliteFile
        ? "sqlite"
        : formatRaw && isImportFormat(formatRaw)
          ? formatRaw
          : (sniffFormatFromName(file.name) ?? sniffFormatFromText(buffer.toString("utf8")));

      return await dispatch(buffer, format, table || null);
    }

    // ---- pasted text
    const body: unknown = await req.json().catch(() => null);
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const text = typeof b.text === "string" ? b.text : "";
    const formatRaw = typeof b.format === "string" ? b.format.trim() : "";

    if (!text.trim()) {
      return NextResponse.json({ error: "Paste some data first." }, { status: 400 });
    }
    if (Buffer.byteLength(text, "utf8") > MAX_IMPORT_BYTES) {
      return NextResponse.json(
        { error: `That text is too large — keep imports under ${MAX_IMPORT_BYTES / 1024 / 1024} MB.` },
        { status: 413 }
      );
    }
    if (formatRaw === "sqlite") {
      return NextResponse.json(
        { error: "SQLite databases can’t be pasted — upload the .db file instead." },
        { status: 400 }
      );
    }
    const format: ImportFormat =
      formatRaw && isImportFormat(formatRaw) ? formatRaw : sniffFormatFromText(text);
    return await dispatch(Buffer.from(text, "utf8"), format, null);
  } catch (e) {
    if (e instanceof ImportParseError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("import/parse failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse the import source." },
      { status: 500 }
    );
  }
}

async function dispatch(
  buffer: Buffer,
  format: ImportFormat,
  table: string | null
): Promise<NextResponse> {
  if (format === "sqlite") {
    if (!table) {
      const tables = await readSqliteTables(buffer);
      if (tables.length === 0) {
        return NextResponse.json(
          { error: "This database has no tables to import from." },
          { status: 400 }
        );
      }
      if (tables.length === 1) {
        // Single table — skip the picker and read it directly.
        const parsed = await readSqliteRows(buffer, tables[0].name);
        return NextResponse.json({
          format,
          ...parsed,
          suggestedMapping: autoMapColumns(parsed.headers),
        } satisfies ParseImportResponse);
      }
      return NextResponse.json({ format, needsTable: true, tables } satisfies ParseImportResponse);
    }
    const parsed = await readSqliteRows(buffer, table);
    return NextResponse.json({
      format,
      ...parsed,
      suggestedMapping: autoMapColumns(parsed.headers),
    } satisfies ParseImportResponse);
  }

  const text = buffer.toString("utf8");
  const withMapping = (parsed: {
    headers: string[];
    rows: Record<string, string>[];
    truncated: boolean;
    warnings: string[];
  }): ParseImportResponse => ({ format, ...parsed, suggestedMapping: autoMapColumns(parsed.headers) });

  // Content sniffing: JSON uploaded/pasted under a CSV/TSV card, or delimited
  // data pasted under the JSON card — parse what the data actually is.
  const trimmed = text.trimStart().replace(/^\uFEFF/, "");
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");

  if (format === "json") {
    try {
      return NextResponse.json(withMapping(parseJsonImport(text)));
    } catch (jsonError) {
      if (looksJson) throw jsonError; // genuinely broken JSON → show the JSON error
      try {
        const parsed = parseDelimited(text, "csv");
        parsed.warnings.push("This didn’t parse as JSON — treated it as CSV.");
        return NextResponse.json(withMapping(parsed));
      } catch {
        throw jsonError;
      }
    }
  }

  if (looksJson) {
    try {
      const parsed = parseJsonImport(text);
      parsed.warnings.push("Detected JSON content — parsed it as JSON.");
      return NextResponse.json({ ...withMapping(parsed), format: "json" } satisfies ParseImportResponse);
    } catch {
      // fall through to delimited parsing
    }
  }

  const parsed = parseDelimited(text, format === "tsv" ? "tsv" : "csv");
  return NextResponse.json(withMapping(parsed));
}
