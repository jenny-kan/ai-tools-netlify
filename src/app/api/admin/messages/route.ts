import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";

/** Admin: list all contact messages, newest first. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return unauthorized();

  const messages = await db.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(messages);
}
