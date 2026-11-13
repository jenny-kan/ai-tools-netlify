import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tools/export — the tool catalog as a spreadsheet-friendly CSV.
 *
 * Scope: PUBLISHED tools (the same public data the homepage renders — no
 * drafts, no admin-only fields). The column headers are deliberately chosen
 * so the admin bulk-importer auto-maps every one of them: export → edit in
 * Excel/Sheets → re-import round-trips cleanly.
 *
 * Format details for maximum compatibility:
 *  - UTF-8 BOM so Excel detects the encoding (text contains typographic quotes)
 *  - CRLF line endings + every field quoted (RFC 4180)
 *  - `yes`/`no` booleans, UPPERCASE enums — exactly what the importer coerces
 */
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`tools-export:${ip}`, 30, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many exports from this address — try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 3600) } }
    );
  }

  const tools = await db.tool.findMany({
    where: { status: "PUBLISHED" },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  const HEADERS = [
    "Name",
    "Category",
    "Short description",
    "Official URL",
    "Pricing model",
    "Free trial",
    "Trial note",
    "Description",
    "Example",
    "Free plan limits",
    "Use cases",
    "Status",
    "Slug",
    "Pricing last checked",
  ];

  // RFC 4180 escaping — quote every field, double embedded quotes.
  const cell = (value: string | null | undefined): string =>
    `"${(value ?? "").replace(/"/g, '""')}"`;

  const lines: string[] = [HEADERS.map(cell).join(",")];
  for (const t of tools) {
    lines.push(
      [
        cell(t.name),
        cell(t.category?.name ?? ""),
        cell(t.shortDescription),
        cell(t.officialUrl),
        cell(t.pricingModel),
        cell(t.hasFreeTrial ? "yes" : "no"),
        cell(t.trialNote),
        cell(t.description),
        cell(t.example),
        cell(t.freePlanLimits),
        cell(t.useCases),
        cell(t.status),
        cell(t.slug),
        cell(t.pricingLastChecked.toISOString().slice(0, 10)),
      ].join(",")
    );
  }

  // \uFEFF = UTF-8 BOM (Excel opens the file with correct encoding).
  const csv = `\uFEFF${lines.join("\r\n")}\r\n`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ai-tools-central-tools.csv"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
