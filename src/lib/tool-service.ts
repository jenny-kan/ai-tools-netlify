import type { Category, Tool } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { PricingModel, ToolDTO, ToolStatus } from "@/lib/types";

const PRICING = new Set(["FREE", "FREEMIUM", "PAID"]);
const STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "tool"
  );
}

/** Find a slug derived from `base` that isn't taken (appends -2, -3, …). */
export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let i = 2;
  for (;;) {
    const existing = await db.tool.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${root}-${i++}`;
  }
}

export async function uniqueCategorySlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let i = 2;
  for (;;) {
    const existing = await db.category.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${root}-${i++}`;
  }
}

/** Accepts bare domains by prepending https://; returns null if unparseable. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export interface ToolPayload {
  name: string;
  shortDescription: string;
  description: string;
  example: string;
  freePlanLimits: string;
  useCases: string;
  officialUrl: string;
  pricingModel: string;
  hasFreeTrial: boolean;
  trialNote: string;
  pricingLastChecked: string; // ISO
  categoryId: string;
  status: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Fields required before publication (per spec: name, description, URL, category, pricing model). */
export function missingPublishFields(t: {
  name: string;
  shortDescription: string;
  officialUrl: string;
  categoryId: string;
  pricingModel: string;
}): string[] {
  const missing: string[] = [];
  if (!t.name.trim()) missing.push("name");
  if (!t.shortDescription.trim()) missing.push("description");
  if (!t.officialUrl.trim()) missing.push("officialUrl");
  else if (!normalizeUrl(t.officialUrl)) missing.push("officialUrl (invalid)");
  if (!t.categoryId.trim()) missing.push("category");
  if (!PRICING.has(t.pricingModel)) missing.push("pricingModel");
  return missing;
}

type ValidateResult =
  | { ok: true; data: ToolPayload }
  | { ok: false; error: string; missing?: string[]; status: number };

export function validateToolPayload(raw: unknown): ValidateResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid request body.", status: 400 };
  }
  const b = raw as Record<string, unknown>;

  const name = str(b.name);
  const shortDescription = str(b.shortDescription);
  const officialUrlRaw = str(b.officialUrl);
  const categoryId = str(b.categoryId);
  const pricingModel = str(b.pricingModel);
  const status = str(b.status) || "DRAFT";

  if (!STATUSES.has(status)) {
    return { ok: false, error: `Invalid status “${status}”.`, status: 400 };
  }
  if (!PRICING.has(pricingModel)) {
    return { ok: false, error: "pricingModel must be FREE, FREEMIUM, or PAID.", status: 400 };
  }
  if (!name) {
    return { ok: false, error: "A tool needs at least a name.", status: 400 };
  }
  if (!categoryId) {
    return {
      ok: false,
      error: "Pick a category — it’s required for drafts and published listings alike.",
      status: 400,
    };
  }

  const officialUrl = officialUrlRaw ? normalizeUrl(officialUrlRaw) : null;
  if (status === "PUBLISHED") {
    const missing = missingPublishFields({
      name,
      shortDescription,
      officialUrl: officialUrlRaw,
      categoryId,
      pricingModel,
    });
    if (missing.length > 0) {
      return {
        ok: false,
        error: "Cannot publish — required fields are missing.",
        missing,
        status: 422,
      };
    }
  }

  let pricingLastChecked = new Date();
  if (typeof b.pricingLastChecked === "string" && b.pricingLastChecked) {
    const d = new Date(b.pricingLastChecked);
    if (!Number.isNaN(d.getTime())) pricingLastChecked = d;
  }

  return {
    ok: true,
    data: {
      name,
      shortDescription,
      description: str(b.description),
      example: str(b.example),
      freePlanLimits: str(b.freePlanLimits),
      useCases: str(b.useCases),
      officialUrl: officialUrl ?? officialUrlRaw,
      pricingModel,
      hasFreeTrial: b.hasFreeTrial === true,
      trialNote: str(b.trialNote),
      pricingLastChecked: pricingLastChecked.toISOString(),
      categoryId,
      status,
    },
  };
}

/** Prisma entity → API DTO (dates as ISO strings). */
export function serializeTool(
  t: Tool & { category: Category | null }
): ToolDTO {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    shortDescription: t.shortDescription,
    description: t.description,
    example: t.example,
    freePlanLimits: t.freePlanLimits,
    useCases: t.useCases,
    officialUrl: t.officialUrl,
    pricingModel: t.pricingModel as PricingModel,
    hasFreeTrial: t.hasFreeTrial,
    trialNote: t.trialNote,
    pricingLastChecked: t.pricingLastChecked.toISOString(),
    status: t.status as ToolStatus,
    categoryId: t.categoryId,
    category: t.category
      ? {
          id: t.category.id,
          name: t.category.name,
          slug: t.category.slug,
          icon: t.category.icon,
        }
      : undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

const normName = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/**
 * Tools that look like the given name/URL (any status) — for duplicate flagging.
 * Flags exact/contained normalized-name matches and identical domains.
 */
export async function findDuplicates(opts: {
  name?: string;
  url?: string;
  excludeId?: string;
}): Promise<(Tool & { category: Category | null })[]> {
  const tools = await db.tool.findMany({
    include: { category: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  const name = opts.name?.trim() ?? "";
  const url = opts.url?.trim() ?? "";
  const targetHost = url ? hostOf(normalizeUrl(url) ?? url) : "";

  return tools.filter((t) => {
    if (opts.excludeId && t.id === opts.excludeId) return false;
    if (name) {
      const a = normName(t.name);
      const b = normName(name);
      if (a && b) {
        if (a === b) return true;
        if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
      }
    }
    if (targetHost) {
      const h = hostOf(t.officialUrl);
      if (h && h === targetHost) return true;
    }
    return false;
  });
}
