import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { forbiddenOrigin, isSameOrigin } from "@/lib/security";
import { isMessageStatus } from "@/lib/contact-security";

type Params = { params: Promise<{ id: string }> };

/** Admin: update a message's status (NEW | READ | ARCHIVED). */
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const { id } = await params;
  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const status = (body as Record<string, unknown>).status;
  if (!isMessageStatus(status)) {
    return NextResponse.json(
      { error: "Status must be NEW, READ, or ARCHIVED." },
      { status: 400 }
    );
  }

  const existing = await db.contactMessage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const message = await db.contactMessage.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(message);
}

/** Admin: permanently delete a message. */
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const { id } = await params;
  const existing = await db.contactMessage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  await db.contactMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
