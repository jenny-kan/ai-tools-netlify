import { NextResponse } from "next/server";
import { checkRateLimit, clientIp, createChallenge } from "@/lib/contact-security";

/**
 * Public: generate a fresh math challenge for the contact form.
 * Rate limited so bots can't mint unlimited tokens.
 */
export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = checkRateLimit(ip, "challenge");
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec ?? 60) } }
    );
  }
  return NextResponse.json(createChallenge(), {
    headers: { "Cache-Control": "no-store" },
  });
}
