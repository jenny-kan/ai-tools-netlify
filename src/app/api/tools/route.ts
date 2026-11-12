import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchTools, sortByName } from "@/lib/search";
import { serializeTool } from "@/lib/tool-service";

/**
 * Public catalog: published listings only.
 * Supports ?q= &category= &pricing= &trial=1 (the homepage also filters
 * client-side for instant search — this endpoint is the server-side source).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category");
  const pricing = searchParams.get("pricing");
  const trial = searchParams.get("trial") === "1";

  const tools = await db.tool.findMany({
    where: { status: "PUBLISHED" },
    include: { category: true },
  });

  let list = tools.map(serializeTool);
  list = q ? searchTools(list, q) : sortByName(list);

  if (category) list = list.filter((t) => t.category?.slug === category);
  if (pricing) list = list.filter((t) => t.pricingModel === pricing);
  if (trial) list = list.filter((t) => t.hasFreeTrial);

  return NextResponse.json(list);
}
