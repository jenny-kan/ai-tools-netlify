import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { forbiddenOrigin, isSameOrigin } from "@/lib/security";
import { uniqueCategorySlug } from "@/lib/tool-service";

/** Admin: rename / re-icon a category (slug regenerates when the name changes). */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const { id } = await params;
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  }

  const nameTaken = await db.category.findFirst({
    where: { name, id: { not: id } },
  });
  if (nameTaken) {
    return NextResponse.json(
      { error: `A category named “${name}” already exists.` },
      { status: 409 }
    );
  }

  const slug =
    name !== existing.name ? await uniqueCategorySlug(name, id) : existing.slug;

  const category = await db.category.update({
    where: { id },
    data: {
      name,
      slug,
      description: typeof b.description === "string" ? b.description.trim() : existing.description,
      icon: typeof b.icon === "string" && b.icon.trim() ? b.icon.trim() : existing.icon,
    },
    include: { _count: { select: { tools: true } } },
  });

  return NextResponse.json({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    toolCount: category._count.tools,
  });
}

/** Admin: delete a category — blocked while tools are still assigned. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const { id } = await params;
  const existing = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { tools: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  if (existing._count.tools > 0) {
    return NextResponse.json(
      {
        error: `Can’t delete “${existing.name}” — ${existing._count.tools} ${
          existing._count.tools === 1 ? "tool" : "tools"
        } still use this category. Reassign or delete them first.`,
      },
      { status: 409 }
    );
  }

  await db.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
