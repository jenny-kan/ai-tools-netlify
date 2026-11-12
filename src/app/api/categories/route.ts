import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Public categories with published-tool counts (powers the filter pills and footer). */
export async function GET() {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { tools: { where: { status: "PUBLISHED" } } } },
    },
  });

  return NextResponse.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon: c.icon,
      toolCount: c._count.tools,
    }))
  );
}
