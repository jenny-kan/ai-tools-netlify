import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forbiddenOrigin, getClientIp, isSameOrigin, rateLimit, sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Privacy-friendly page-view beacon. Collects: path, referrer host,
 * anonymous session id, optional tool slug. No cookies, no PII, no
 * cross-site tracking — aggregate traffic stats only.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return forbiddenOrigin();

  const ip = getClientIp(req);
  const limited = rateLimit(`analytics:${ip}`, 240, 60 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ ok: true }); // silently drop

  const raw: unknown = await req.json().catch(() => null);
  if (typeof raw !== "object" || raw === null) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const b = raw as Record<string, unknown>;

  const path = sanitizeText(typeof b.path === "string" ? b.path : "");
  const referrer = sanitizeText(typeof b.referrer === "string" ? b.referrer : "").slice(0, 300);
  const sessionId = sanitizeText(typeof b.sessionId === "string" ? b.sessionId : "").slice(0, 64);
  const toolSlug = sanitizeText(typeof b.toolSlug === "string" ? b.toolSlug : "").slice(0, 80);

  if (!path.startsWith("/") || path.length > 200) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }
  if (!sessionId || sessionId.length < 8) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  // Only keep the referrer's origin — full URLs can contain user data.
  let referrerOrigin = "";
  if (referrer) {
    try {
      referrerOrigin = new URL(referrer).origin;
    } catch {
      referrerOrigin = "";
    }
  }

  await db.pageView.create({ data: { path, referrer: referrerOrigin, sessionId, toolSlug } });
  return NextResponse.json({ ok: true });
}
