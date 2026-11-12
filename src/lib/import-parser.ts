import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { db } from "@/lib/db";
import { normalizeUrl, uniqueCategorySlug, uniqueSlug } from "@/lib/tool-service";
import type {
  ImportFieldKey,
  ImportOptionsDTO,
  ImportRowResultDTO,
  ImportRunResponseDTO,
  PricingModel,
  SqliteTableInfoDTO,
  ToolStatus,
} from "@/lib/types";

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB — security cap

/** Thrown for user-facing parse problems — message is shown verbatim in the UI. */
export class ImportParseError extends Error {}

// ------------------------------------------------------------------ text utils

/** Lowercase + strip everything that isn't a letter or digit. */
const normKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (ArrayBuffer.isView(v)) return ""; // BLOBs carry no text we can use
  return JSON.stringify(v);
}

// ------------------------------------------------------------------ CSV / TSV

/**
 * RFC 4180-style record parser: quoted fields, "" escapes, newlines inside
 * quotes, and both CRLF / LF line endings.
 */
export function parseDelimitedRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let startedField = false;

  const endField = () => {
    row.push(field);
    field = "";
    startedField = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !startedField && field === "") {
      inQuotes = true;
      startedField = true;
      continue;
    }
    if (ch === delimiter) {
      endField();
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      continue;
    }
    field += ch;
    startedField = true;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Guess the delimiter from the first line (Excel-style `;` exports, stray tabs…). */
function sniffDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (c: string) => firstLine.split(c).length - 1;
  const tabs = count("\t");
  const commas = count(",");
  const semis = count(";");
  if (tabs > commas && tabs >= semis) return "\t";
  if (semis > commas) return ";";
  return ",";
}

/** Parse delimited text into header-keyed row objects. */
export function parseDelimited(
  text: string,
  format: "csv" | "tsv"
): { headers: string[]; rows: Record<string, string>[]; truncated: boolean; warnings: string[] } {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = format === "tsv" ? "\t" : sniffDelimiter(clean);
  const records = parseDelimitedRecords(clean, delimiter);

  // First non-empty record is the header row.
  const headerIdx = records.findIndex((r) => r.some((c) => c.trim() !== ""));
  if (headerIdx === -1) {
    throw new ImportParseError("The file appears to be empty.");
  }
  const rawHeaders = records[headerIdx].map((h) => h.trim());

  // De-duplicate/blank-proof headers while keeping their order.
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    const base = h || `column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });

  const warnings: string[] = [];
  const rows: Record<string, string>[] = [];
  let truncated = false;
  for (let i = headerIdx + 1; i < records.length; i++) {
    const rec = records[i];
    if (!rec.some((c) => c.trim() !== "")) continue; // skip blank lines
    if (rows.length >= MAX_IMPORT_ROWS) {
      truncated = true;
      warnings.push(`Only the first ${MAX_IMPORT_ROWS} rows are imported (file has more).`);
      break;
    }
    const obj: Record<string, string> = {};
    headers.forEach((h, col) => {
      obj[h] = (rec[col] ?? "").trim();
    });
    rows.push(obj);
  }

  if (rows.length === 0) {
    throw new ImportParseError(
      "No data rows found — the file needs a header row followed by at least one tool row."
    );
  }
  if (delimiter === ";") {
    warnings.push("Semicolon `;` delimiter detected (common for Excel exports in some locales).");
  }
  return { headers, rows, truncated, warnings };
}

// ------------------------------------------------------------------ JSON

const JSON_ARRAY_KEYS = ["tools", "items", "data", "results", "records", "rows"];

export function parseJsonImport(
  text: string
): { headers: string[]; rows: Record<string, string>[]; truncated: boolean; warnings: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportParseError("That doesn’t look like valid JSON — check for missing commas or quotes.");
  }

  let list: unknown[];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const arrayKey = JSON_ARRAY_KEYS.find((k) => Array.isArray(obj[k]));
    if (arrayKey) {
      list = obj[arrayKey] as unknown[];
    } else if ("name" in obj || "title" in obj) {
      list = [obj]; // a single tool object
    } else {
      const values = Object.values(obj);
      if (values.length > 0 && values.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
        list = values; // map of id → tool
      } else {
        throw new ImportParseError(
          "JSON must be an array of tool objects, or an object with a tools/items/data array."
        );
      }
    }
  } else {
    throw new ImportParseError("JSON must be an array of tool objects.");
  }

  if (list.length === 0) {
    throw new ImportParseError("The JSON array is empty — nothing to import.");
  }
  if (list.some((x) => !x || typeof x !== "object" || Array.isArray(x))) {
    throw new ImportParseError("Every entry in the JSON array must be an object (a single tool).");
  }

  const warnings: string[] = [];
  const headers: string[] = [];
  const headerSet = new Set<string>();
  const listCapped = list.length > MAX_IMPORT_ROWS;
  if (listCapped) {
    warnings.push(`Only the first ${MAX_IMPORT_ROWS} entries are imported (file has more).`);
    list = list.slice(0, MAX_IMPORT_ROWS);
  }

  for (const entry of list) {
    for (const key of Object.keys(entry as object)) {
      if (!headerSet.has(key)) {
        headerSet.add(key);
        headers.push(key);
      }
    }
  }

  const rows = (list as Record<string, unknown>[]).map((entry) => {
    const row: Record<string, string> = {};
    for (const key of Object.keys(entry)) row[key] = stringifyValue(entry[key]).trim();
    return row;
  });

  return { headers, rows, truncated: listCapped, warnings };
}

// ------------------------------------------------------------------ SQLite

/** Hides the dynamic import from bundlers so both Node and Bun drivers work. */
const dynamicImport = new Function("m", "return import(m)") as (
  m: string
) => Promise<Record<string, unknown>>;

interface SqliteStatement {
  all: (...params: unknown[]) => unknown[];
}
interface SqliteConnection {
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
}

async function loadSqliteDriver(): Promise<{
  open: (path: string) => SqliteConnection;
}> {
  // Node 22.5+ ships node:sqlite (unflagged since Node 23.4).
  try {
    const mod = await dynamicImport("node:sqlite");
    const Ctor = mod.DatabaseSync as new (path: string, opts: { readOnly: boolean }) => SqliteConnection;
    if (Ctor) return { open: (p) => new Ctor(p, { readOnly: true }) };
  } catch {
    // fall through to bun:sqlite
  }
  // Bun runtime.
  try {
    const mod = await dynamicImport("bun:sqlite");
    const Ctor = mod.Database as new (path: string, opts: { readonly: boolean }) => SqliteConnection;
    if (Ctor) return { open: (p) => new Ctor(p, { readonly: true }) };
  } catch {
    // fall through
  }
  throw new ImportParseError(
    "This server runtime has no SQLite driver (needs Node 22.5+ or Bun) — use CSV, TSV, or JSON instead."
  );
}

/** Double-quote an SQLite identifier, escaping embedded quotes. */
const qid = (name: string): string => `"${name.replace(/"/g, '""')}"`;

/** Write the upload to a temp file, open it read-only, run `fn`, always clean up. */
async function withSqlite<T>(buffer: Buffer, fn: (query: (sql: string) => unknown[]) => T): Promise<T> {
  const driver = await loadSqliteDriver();
  const dir = await mkdtemp(join(tmpdir(), "atf-import-"));
  const path = join(dir, "upload.db");
  try {
    await writeFile(path, buffer);
    let conn: SqliteConnection;
    try {
      conn = driver.open(path);
    } catch {
      throw new ImportParseError("That file couldn’t be opened as an SQLite database.");
    }
    try {
      return fn((sql) => conn.prepare(sql).all());
    } finally {
      conn.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function readSqliteTables(buffer: Buffer): Promise<SqliteTableInfoDTO[]> {
  return withSqlite(buffer, (query) => {
    const tables = query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name"
    ) as { name: string }[];
    return tables.map((t) => {
      const columns = (query(`PRAGMA table_info(${qid(t.name)})`) as { name: string }[]).map(
        (c) => c.name
      );
      const countRows = query(`SELECT COUNT(*) AS c FROM ${qid(t.name)}`) as { c: number }[];
      return { name: t.name, rowCount: Number(countRows[0]?.c ?? 0), columns };
    });
  });
}

export async function readSqliteRows(
  buffer: Buffer,
  table: string
): Promise<{ headers: string[]; rows: Record<string, string>[]; truncated: boolean; warnings: string[] }> {
  return withSqlite(buffer, (query) => {
    const columns = (query(`PRAGMA table_info(${qid(table)})`) as { name: string }[]).map(
      (c) => c.name
    );
    if (columns.length === 0) {
      throw new ImportParseError(`Table “${table}” doesn’t exist in this database.`);
    }
    const colList = columns.map(qid).join(", ");
    const raw = query(`SELECT ${colList} FROM ${qid(table)} LIMIT ${MAX_IMPORT_ROWS + 1}`) as Record<
      string,
      unknown
    >[];
    const warnings: string[] = [];
    const truncated = raw.length > MAX_IMPORT_ROWS;
    if (truncated) {
      warnings.push(`Only the first ${MAX_IMPORT_ROWS} rows are imported (table has more).`);
      raw.length = MAX_IMPORT_ROWS;
    }
    const rows = raw
      .map((r) => {
        const row: Record<string, string> = {};
        for (const c of columns) row[c] = stringifyValue(r[c]).trim();
        return row;
      })
      .filter((r) => Object.values(r).some((v) => v !== ""));
    if (rows.length === 0) {
      throw new ImportParseError(`Table “${table}” has no rows.`);
    }
    return { headers: columns, rows, truncated, warnings };
  });
}

// ------------------------------------------------------------------ field mapping

/** Header aliases per tool field (compared via normKey). */
const FIELD_ALIASES: Record<ImportFieldKey, string[]> = {
  name: ["name", "tool", "toolname", "title", "tooltitle"],
  categoryName: ["category", "categoryname", "cat", "topic", "topics", "tag", "tags", "group", "bucket", "section"],
  shortDescription: ["shortdescription", "shortdesc", "summary", "tagline", "blurb", "oneliner", "pitch", "short"],
  officialUrl: ["url", "officialurl", "website", "link", "site", "homepage", "official", "toolurl", "webaddress"],
  pricingModel: ["pricing", "pricingmodel", "price", "pricemodel", "cost", "pricingtype"],
  status: ["status", "state", "visibility", "publishstate"],
  description: ["description", "desc", "details", "longdescription", "fulldescription", "about", "overview", "notes"],
  example: ["example", "examples", "sample", "samples", "promptexample", "useexample", "demoprompt"],
  freePlanLimits: ["freeplanlimits", "freelimits", "freetier", "freetierlimits", "freeplan", "freequota", "quota", "limits"],
  useCases: ["usecases", "usecase", "cases", "applications", "scenarios", "bestfor"],
  hasFreeTrial: ["freetrial", "hasfreetrial", "trial", "trials", "offerstrial"],
  trialNote: ["trialnote", "trialnotes", "trialdetails", "triallength", "trialduration"],
};

/** Pick the most likely column for every field based on header aliases. */
export function autoMapColumns(headers: string[]): Partial<Record<ImportFieldKey, string>> {
  const used = new Set<string>();
  const result: Partial<Record<ImportFieldKey, string>> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [ImportFieldKey, string[]][]) {
    const aliasSet = new Set(aliases);
    const header = headers.find((h) => aliasSet.has(normKey(h)) && !used.has(h));
    if (header) {
      result[field] = header;
      used.add(header);
    }
  }
  return result;
}

const PRICING_COERCIONS: Record<string, PricingModel> = {
  free: "FREE",
  freetool: "FREE",
  opensource: "FREE",
  open: "FREE",
  freemium: "FREEMIUM",
  freeplan: "FREEMIUM",
  freetier: "FREEMIUM",
  freeversion: "FREEMIUM",
  paid: "PAID",
  premium: "PAID",
  subscription: "PAID",
  subscribe: "PAID",
  commercial: "PAID",
  trialware: "PAID",
};

function coercePricing(raw: string): PricingModel | null {
  const k = normKey(raw);
  return PRICING_COERCIONS[k] ?? null;
}

const STATUS_COERCIONS: Record<string, ToolStatus> = {
  draft: "DRAFT",
  drafts: "DRAFT",
  unpublished: "DRAFT",
  wip: "DRAFT",
  published: "PUBLISHED",
  publish: "PUBLISHED",
  live: "PUBLISHED",
  public: "PUBLISHED",
  archived: "ARCHIVED",
  archive: "ARCHIVED",
};

function coerceStatus(raw: string): ToolStatus | null {
  const k = normKey(raw);
  return STATUS_COERCIONS[k] ?? null;
}

const TRUTHY = new Set(["true", "yes", "y", "1", "t", "x", "on", "available", "offered"]);
const FALSY = new Set(["false", "no", "n", "0", "f", "off", "none", "unavailable"]);

function coerceBoolean(raw: string): boolean | null {
  const k = raw.toLowerCase().trim();
  if (!k) return null;
  if (TRUTHY.has(k)) return true;
  if (FALSY.has(k)) return false;
  return null;
}

// ------------------------------------------------------------------ duplicate detection

const normName = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// ------------------------------------------------------------------ import runner

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function validateImportOptions(raw: unknown): ImportOptionsDTO | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "Missing import options." };
  const o = raw as Record<string, unknown>;
  const defaultStatus = str(o.defaultStatus);
  const defaultPricingModel = str(o.defaultPricingModel);
  if (!["DRAFT", "PUBLISHED"].includes(defaultStatus)) {
    return { error: "Default status must be DRAFT or PUBLISHED." };
  }
  if (!["FREE", "FREEMIUM", "PAID"].includes(defaultPricingModel)) {
    return { error: "Default pricing model must be FREE, FREEMIUM, or PAID." };
  }
  return {
    defaultStatus: defaultStatus as ToolStatus,
    defaultPricingModel: defaultPricingModel as PricingModel,
    defaultCategoryId: str(o.defaultCategoryId),
    skipDuplicates: o.skipDuplicates !== false,
    autoCreateCategories: o.autoCreateCategories === true,
  };
}

/**
 * Maps, validates, and (unless dry-run) writes the submitted rows.
 * Bad rows never abort the batch — each row reports its own outcome.
 */
export async function runToolImport(input: {
  rows: Record<string, string>[];
  mapping: Partial<Record<ImportFieldKey, string>>;
  options: ImportOptionsDTO;
  dryRun: boolean;
}): Promise<ImportRunResponseDTO> {
  const { rows, mapping, options, dryRun } = input;

  const existingCategories = await db.category.findMany({ select: { id: true, name: true, slug: true } });
  const catByName = new Map<string, { id: string; name: string }>();
  const catBySlug = new Map<string, { id: string; name: string }>();
  for (const c of existingCategories) {
    catByName.set(c.name.toLowerCase(), { id: c.id, name: c.name });
    catBySlug.set(c.slug.toLowerCase(), { id: c.id, name: c.name });
  }

  let defaultCategory: { id: string; name: string } | null = null;
  if (options.defaultCategoryId) {
    const found = existingCategories.find((c) => c.id === options.defaultCategoryId);
    if (!found) {
      throw new ImportParseError("The chosen default category no longer exists — refresh and try again.");
    }
    defaultCategory = { id: found.id, name: found.name };
  }

  const existingTools = await db.tool.findMany({
    select: { id: true, name: true, slug: true, officialUrl: true },
  });
  const existingByName = new Map<string, { id: string; name: string; slug: string }>();
  const existingByHost = new Map<string, { id: string; name: string; slug: string }>();
  for (const t of existingTools) {
    const n = normName(t.name);
    if (n) existingByName.set(n, t);
    const h = hostOf(t.officialUrl);
    if (h) existingByHost.set(h, t);
  }

  // Categories that need creating — memoized per name (and created once).
  const pendingCategories = new Map<string, { id: string; name: string; slug: string; isNew: boolean }>();
  const categoriesCreated: { name: string; slug: string }[] = [];

  // Rows already (or about to be) imported in this batch, for in-batch duplicate flags.
  const batchNames = new Map<string, { index: number; name: string }>();
  const batchHosts = new Map<string, { index: number; name: string }>();

  const field = (row: Record<string, string>, key: ImportFieldKey): string => {
    const header = mapping[key];
    if (!header) return "";
    return str(row[header]);
  };

  const results: ImportRowResultDTO[] = [];
  let importable = 0;
  let duplicates = 0;
  let errors = 0;
  let created = 0;
  let skippedDuplicates = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    const name = field(row, "name");
    if (!name) {
      results.push({
        index: i,
        name: "",
        status: "error",
        errors: ["Row has no name — map the “Name” column."],
        warnings: [],
        duplicate: false,
        category: "",
        pricing: "",
        finalStatus: options.defaultStatus,
        created: false,
      });
      errors++;
      continue;
    }

    // -- pricing
    const pricingRaw = field(row, "pricingModel");
    let pricing = coercePricing(pricingRaw);
    if (!pricing) {
      if (pricingRaw) rowWarnings.push(`Unknown pricing “${pricingRaw}” — using the default.`);
      pricing = options.defaultPricingModel;
    }

    // -- status
    const statusRaw = field(row, "status");
    let finalStatus = coerceStatus(statusRaw);
    if (!finalStatus) {
      if (statusRaw) rowWarnings.push(`Unknown status “${statusRaw}” — using the default.`);
      finalStatus = options.defaultStatus;
    }

    // -- category
    let categoryLabel = "";
    let categoryId = "";
    const catRaw = field(row, "categoryName");
    if (catRaw) {
      const existing = catByName.get(catRaw.toLowerCase()) ?? catBySlug.get(catRaw.toLowerCase());
      if (existing) {
        categoryId = existing.id;
        categoryLabel = existing.name;
      } else if (options.autoCreateCategories) {
        const pending = pendingCategories.get(catRaw.toLowerCase());
        if (pending) {
          categoryId = pending.id;
          categoryLabel = pending.name;
        } else {
          const slug = await uniqueCategorySlug(catRaw);
          const record = { id: `new:${slug}`, name: catRaw, slug, isNew: true };
          pendingCategories.set(catRaw.toLowerCase(), record);
          categoryId = record.id;
          categoryLabel = catRaw;
        }
      } else if (defaultCategory) {
        rowWarnings.push(`Unknown category “${catRaw}” — using the default.`);
        categoryId = defaultCategory.id;
        categoryLabel = defaultCategory.name;
      } else {
        rowErrors.push(
          `Unknown category “${catRaw}” — enable auto-create or pick a default category.`
        );
      }
    } else if (defaultCategory) {
      categoryId = defaultCategory.id;
      categoryLabel = defaultCategory.name;
    } else {
      rowErrors.push("No category — map a category column, pick a default, or enable auto-create.");
    }

    // -- URL
    const urlRaw = field(row, "officialUrl");
    const url = urlRaw ? (normalizeUrl(urlRaw) ?? "") : "";
    if (urlRaw && !url) rowErrors.push(`“${urlRaw}” is not a valid URL.`);

    // -- publish requirements
    const shortDescription = field(row, "shortDescription");
    if (finalStatus === "PUBLISHED") {
      if (!shortDescription) rowErrors.push("Published tools need a short description.");
      if (!url) rowErrors.push("Published tools need a valid official URL.");
    } else {
      if (!shortDescription) rowWarnings.push("No short description — add one before publishing.");
      if (!url) rowWarnings.push("No URL — add one before publishing.");
    }

    // -- duplicate detection (existing catalog + earlier rows in this batch)
    let duplicate = false;
    let duplicateOfName: string | undefined;
    let duplicateOfId: string | undefined;
    let duplicateInBatch: number | undefined;
    const norm = normName(name);
    const host = url ? hostOf(url) : "";
    const existingHit = (norm ? existingByName.get(norm) : undefined) ?? (host ? existingByHost.get(host) : undefined);
    if (existingHit) {
      duplicate = true;
      duplicateOfName = existingHit.name;
      duplicateOfId = existingHit.id;
    } else {
      const nameHit = norm ? batchNames.get(norm) : undefined;
      const hostHit = host ? batchHosts.get(host) : undefined;
      const batchHit = nameHit ?? hostHit;
      if (batchHit) {
        duplicate = true;
        duplicateInBatch = batchHit.index;
        duplicateOfName = batchHit.name;
      }
    }

    if (rowErrors.length > 0) {
      errors++;
      results.push({
        index: i,
        name,
        status: "error",
        errors: rowErrors,
        warnings: rowWarnings,
        duplicate,
        duplicateOfName,
        duplicateOfId,
        duplicateInBatch,
        category: categoryLabel,
        pricing,
        finalStatus,
        created: false,
      });
      continue;
    }

    if (duplicate && options.skipDuplicates) {
      skippedDuplicates++;
      duplicates++;
      results.push({
        index: i,
        name,
        status: "ok",
        errors: [],
        warnings: rowWarnings,
        duplicate: true,
        duplicateOfName,
        duplicateOfId,
        duplicateInBatch,
        category: categoryLabel,
        pricing,
        finalStatus,
        created: false,
      });
      continue;
    }

    // -- write
    let createdRow = false;
    let failedReason: string | undefined;
    if (!dryRun) {
      try {
        // Ensure the category exists (auto-created categories are shared across rows).
        let realCategoryId = categoryId;
        const pending = pendingCategories.get(catRaw.toLowerCase());
        if (pending) {
          const existing = await db.category.findFirst({
            where: { OR: [{ name: pending.name }, { slug: pending.slug }] },
          });
          const category =
            existing ??
            (await db.category.create({
              data: { name: pending.name, slug: pending.slug, description: "", icon: "Sparkles" },
            }));
          if (pending.isNew) {
            categoriesCreated.push({ name: category.name, slug: category.slug });
            pending.isNew = false;
          }
          pending.id = category.id;
          catByName.set(category.name.toLowerCase(), { id: category.id, name: category.name });
          realCategoryId = category.id;
        }

        const slug = await uniqueSlug(name);
        const tool = await db.tool.create({
          data: {
            name,
            slug,
            shortDescription,
            description: field(row, "description"),
            example: field(row, "example"),
            freePlanLimits: field(row, "freePlanLimits"),
            useCases: field(row, "useCases"),
            officialUrl: url,
            pricingModel: pricing,
            hasFreeTrial: coerceBoolean(field(row, "hasFreeTrial")) === true,
            trialNote: field(row, "trialNote"),
            status: finalStatus,
            categoryId: realCategoryId,
          },
        });
        createdRow = true;
        created++;
        // Register against later rows in this batch.
        if (norm) existingByName.set(norm, { id: tool.id, name, slug });
        if (host) existingByHost.set(host, { id: tool.id, name, slug });
      } catch (e) {
        failed++;
        failedReason = e instanceof Error ? e.message : "Could not save this tool.";
      }
    }

    if (dryRun || createdRow) {
      importable++;
      // Later rows with the same name/host flag as in-batch duplicates of this one.
      if (norm && !batchNames.has(norm)) batchNames.set(norm, { index: i, name });
      if (host && !batchHosts.has(host)) batchHosts.set(host, { index: i, name });
    }
    if (duplicate) duplicates++;

    results.push({
      index: i,
      name,
      status: "ok",
      errors: [],
      warnings: rowWarnings,
      duplicate,
      duplicateOfName,
      duplicateOfId,
      duplicateInBatch,
      category: categoryLabel,
      pricing,
      finalStatus,
      created: createdRow,
      failedReason,
    });
  }

  return {
    dryRun,
    summary: {
      total: rows.length,
      importable,
      duplicates,
      errors,
      created,
      skippedDuplicates,
      failed,
      categoriesCreated: dryRun
        ? [...pendingCategories.values()].map((c) => ({ name: c.name, slug: c.slug }))
        : categoriesCreated,
    },
    rows: results,
  };
}
