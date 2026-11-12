import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { forbiddenOrigin, isSameOrigin } from "@/lib/security";
import { findDuplicates, serializeTool, uniqueSlug, validateToolPayload } from "@/lib/tool-service";
import { serverError } from "@/lib/route-errors";

/** Admin: every tool in every status (drafts, published, archived). */
export async function GET() {
  if (!(await isAdminAuthenticated())) return unauthorized();

  try {
    const tools = await db.tool.findMany({
      include: { category: true },
      orderBy: [{ name: "asc" }],
    });
    return NextResponse.json(tools.map(serializeTool));
  } catch (e) {
    return serverError("Loading tools", e);
  }
}

/** Admin: create a tool (as draft or published). */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const raw: unknown = await req.json().catch(() => null);
  const result = validateToolPayload(raw);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.missing ? { missing: result.missing } : {}) },
      { status: result.status }
    );
  }
  const data = result.data;

  try {
    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 400 });
    }

    const slug = await uniqueSlug(data.name);
    const tool = await db.tool.create({
      data: {
        ...data,
        pricingLastChecked: new Date(data.pricingLastChecked),
        slug,
      },
      include: { category: true },
    });

    // Duplicate flagging is advisory — the tool is still created.
    const duplicates = await findDuplicates({
      name: data.name,
      url: data.officialUrl,
      excludeId: tool.id,
    });

    return NextResponse.json(
      { tool: serializeTool(tool), duplicates: duplicates.slice(0, 5).map(serializeTool) },
      { status: 201 }
    );
  } catch (e) {
    return serverError("Creating the tool", e);
  }
}
