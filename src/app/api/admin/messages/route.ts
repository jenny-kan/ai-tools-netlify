import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { serverError } from "@/lib/route-errors";

/** Admin: list all contact messages, newest first. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return unauthorized();

  try {
    const messages = await db.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(messages);
  } catch (e) {
    return serverError("Loading messages", e);
  }
}
