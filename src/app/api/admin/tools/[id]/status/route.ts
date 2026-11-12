import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { forbiddenOrigin, isSameOrigin } from "@/lib/security";
import { missingPublishFields, serializeTool } from "@/lib/tool-service";

const VALID_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);

/**
 * Admin: change a tool's status (publish / unpublish / archive / restore).
 * Publishing re-checks the required fields server-side.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const { id } = await params;
  const body: unknown = await req.json().catch(() => null);
  const status =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).status
      : null;

  if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "status must be DRAFT, PUBLISHED, or ARCHIVED." },
      { status: 400 }
    );
  }

  const existing = await db.tool.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Tool not found." }, { status: 404 });
  }

  if (status === "PUBLISHED") {
    const missing = missingPublishFields(existing);
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot publish — required fields are missing.",
          missing,
        },
        { status: 422 }
      );
    }
  }

  const tool = await db.tool.update({
    where: { id },
    data: { status },
    include: { category: true },
  });

  return NextResponse.json({ tool: serializeTool(tool) });
}
