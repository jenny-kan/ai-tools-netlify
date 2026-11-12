import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import {
  forbiddenOrigin,
  getClientIp,
  isSameOrigin,
  logAudit,
  rateLimit,
  sanitizeText,
} from "@/lib/security";
import { sendEmail, validateOutgoingEmail, isEmailDryRun } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin: reply to a contact message by email, sent server-side via Resend.
 * Replaces the old mailto: link — no email client needed, the reply is
 * recorded on the message and written to the audit trail.
 */
export async function POST(req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) return unauthorized();
  if (!isSameOrigin(req)) return forbiddenOrigin();

  // Rate limit: 12 replies/minute per admin IP — plenty for a human, useless for a spam bot.
  const ip = getClientIp(req);
  const rl = rateLimit(`admin-reply:${ip}`, 12, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many replies sent — try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { id } = await params;
  const body: unknown = await req.json().catch(() => null);
  const replyRaw = typeof body === "object" && body !== null ? (body as Record<string, unknown>).reply : null;
  if (typeof replyRaw !== "string") {
    return NextResponse.json({ error: "Missing reply text." }, { status: 400 });
  }
  const reply = sanitizeText(replyRaw);

  const message = await db.contactMessage.findUnique({ where: { id } });
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  // Build the outgoing email; subject mirrors the visitor's line ("Re: …").
  const outgoing = {
    to: message.email,
    subject: `Re: ${message.subject}`,
    text: reply,
    replyTo: process.env.CONTACT_REPLY_TO || undefined,
  };
  const valid = validateOutgoingEmail(outgoing);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  const result = await sendEmail(outgoing);

  if (!result.delivered && !result.dryRun) {
    // Real send failed — record the attempt, tell the admin honestly.
    logAudit("contact.reply_failed", {
      actorType: "admin",
      actorId: id,
      details: result.detail,
      ip,
    });
    return NextResponse.json(
      { error: `Reply not sent. ${result.detail}` },
      { status: 502 }
    );
  }

  const updated = await db.contactMessage.update({
    where: { id },
    data: {
      replyText: reply.slice(0, 5000),
      repliedAt: new Date(),
      replyEmailId: result.emailId,
      // A reply implies the message was read.
      ...(message.status === "NEW" ? { status: "READ" as const } : {}),
    },
  });

  logAudit("contact.replied", {
    actorType: "admin",
    actorId: id,
    details: `to=${message.email} dryRun=${result.dryRun} id=${result.emailId || "none"}`,
    ip,
  });

  return NextResponse.json({
    message: updated,
    delivered: result.delivered,
    dryRun: result.dryRun || isEmailDryRun(),
  });
}
