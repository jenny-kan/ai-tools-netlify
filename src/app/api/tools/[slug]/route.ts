import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTool } from "@/lib/tool-service";

/** Public tool detail by slug (published only) + related tools in the same category. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const tool = await db.tool.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { category: true },
  });
  if (!tool) {
    return NextResponse.json({ error: "Tool not found." }, { status: 404 });
  }

  const related = await db.tool.findMany({
    where: {
      status: "PUBLISHED",
      categoryId: tool.categoryId,
      id: { not: tool.id },
    },
    include: { category: true },
    orderBy: { name: "asc" },
    take: 4,
  });

  return NextResponse.json({
    tool: serializeTool(tool),
    related: related.map(serializeTool),
  });
}
