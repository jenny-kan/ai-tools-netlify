import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { forbiddenOrigin, getClientIp, isSameOrigin, logAudit, rateLimit, sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Admin: approve or reject a blogger application (with an optional note).
 * Approving unlocks sign-in; rejecting keeps the account locked out.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const limited = rateLimit(`admin-blog-app:${ip}`, 60, 10 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });

  const { id } = await params;
  const raw: unknown = await req.json().catch(() => null);
  const action = typeof raw === "object" && raw !== null ? String((raw as Record<string, unknown>).action ?? "") : "";
  const note = sanitizeText(
    typeof raw === "object" && raw !== null ? String((raw as Record<string, unknown>).note ?? "") : ""
  ).slice(0, 1000);

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Action must be approve or reject." }, { status: 400 });
  }

  const blogger = await db.blogger.findUnique({ where: { id } });
  if (!blogger) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (blogger.status !== "PENDING") {
    return NextResponse.json({ error: `This application was already ${blogger.status.toLowerCase()}.` }, { status: 409 });
  }

  await db.blogger.update({
    where: { id },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      reviewNote: note,
      decidedAt: new Date(),
    },
  });

  logAudit(`blogger.application.${action === "approve" ? "approved" : "rejected"}`, {
    actorType: "admin",
    actorId: blogger.id,
    details: `${blogger.name} <${blogger.email}>${note ? ` — ${note}` : ""}`,
    ip,
  });

  return NextResponse.json({ ok: true });
}
