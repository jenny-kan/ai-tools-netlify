import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forbiddenOrigin, getClientIp, isSameOrigin, logAudit, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Demo-mode payment simulation: mark a pending donation as completed.
 * In production this endpoint is replaced by the payment provider's
 * server-to-server webhook (the ID is a 25-char random cuid, and the
 * endpoint is rate-limited, so guessing is not practical).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const limited = rateLimit(`donate-confirm:${ip}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });

  const { id } = await params;
  const donation = await db.donation.findUnique({ where: { id } });
  if (!donation) return NextResponse.json({ error: "Donation not found." }, { status: 404 });
  if (donation.status !== "PENDING") {
    return NextResponse.json({ error: "This donation was already processed." }, { status: 409 });
  }

  const updated = await db.donation.update({ where: { id }, data: { status: "COMPLETED" } });
  logAudit("donation.completed", { actorType: "visitor", details: `${updated.donorName} — $${(updated.amountCents / 100).toFixed(2)}`, ip });

  return NextResponse.json({
    id: updated.id,
    donorName: updated.donorName,
    email: updated.email,
    amountCents: updated.amountCents,
    currency: updated.currency,
    message: updated.message,
    status: updated.status,
    provider: updated.provider,
    createdAt: updated.createdAt.toISOString(),
  });
}
