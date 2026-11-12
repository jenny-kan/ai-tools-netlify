import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { forbiddenOrigin, isSameOrigin } from "@/lib/security";
import { uniqueCategorySlug } from "@/lib/tool-service";

/** Admin: all categories with total tool counts (all statuses). */
export async function GET() {
  if (!(await isAdminAuthenticated())) return unauthorized();

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { tools: true } } },
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

/** Admin: create a category. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  }

  const existingName = await db.category.findFirst({ where: { name } });
  if (existingName) {
    return NextResponse.json(
      { error: `A category named “${name}” already exists.` },
      { status: 409 }
    );
  }

  const slug = await uniqueCategorySlug(name);
  const category = await db.category.create({
    data: {
      name,
      slug,
      description: typeof b.description === "string" ? b.description.trim() : "",
      icon: typeof b.icon === "string" && b.icon.trim() ? b.icon.trim() : "Sparkles",
    },
  });

  return NextResponse.json(
    {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
      toolCount: 0,
    },
    { status: 201 }
  );
}
