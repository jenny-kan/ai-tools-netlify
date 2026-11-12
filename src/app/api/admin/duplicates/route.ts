import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { findDuplicates, serializeTool } from "@/lib/tool-service";
import { serverError } from "@/lib/route-errors";

/** Admin: check for possible duplicates before/while saving. */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return unauthorized();

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? undefined;
  const url = searchParams.get("url") ?? undefined;
  const excludeId = searchParams.get("excludeId") ?? undefined;

  try {
    const duplicates = await findDuplicates({ name, url, excludeId });
    return NextResponse.json(duplicates.slice(0, 5).map(serializeTool));
  } catch (e) {
    return serverError("Checking duplicates", e);
  }
}
