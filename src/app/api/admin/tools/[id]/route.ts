import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { forbiddenOrigin, isSameOrigin } from "@/lib/security";
import { findDuplicates, serializeTool, uniqueSlug, validateToolPayload } from "@/lib/tool-service";
import { serverError } from "@/lib/route-errors";

/** Admin: update a tool. The payload must carry the target status. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const { id } = await params;

  try {
    const existing = await db.tool.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Tool not found." }, { status: 404 });
    }

    const raw: unknown = await req.json().catch(() => null);
    const merged =
      typeof raw === "object" && raw !== null
        ? { status: existing.status, ...(raw as Record<string, unknown>) }
        : { status: existing.status };

    const result = validateToolPayload(merged);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.missing ? { missing: result.missing } : {}) },
        { status: result.status }
      );
    }
    const data = result.data;

    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 400 });
    }

    const slug =
      data.name !== existing.name ? await uniqueSlug(data.name, id) : existing.slug;

    const tool = await db.tool.update({
      where: { id },
      data: { ...data, pricingLastChecked: new Date(data.pricingLastChecked), slug },
      include: { category: true },
    });

    const duplicates = await findDuplicates({
      name: data.name,
      url: data.officialUrl,
      excludeId: id,
    });

    return NextResponse.json({
      tool: serializeTool(tool),
      duplicates: duplicates.slice(0, 5).map(serializeTool),
    });
  } catch (e) {
    return serverError("Updating the tool", e);
  }
}

/** Admin: permanently delete a tool. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const { id } = await params;

  try {
    const existing = await db.tool.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Tool not found." }, { status: 404 });
    }

    await db.tool.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("Deleting the tool", e);
  }
}
