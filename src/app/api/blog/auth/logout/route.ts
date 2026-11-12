import { NextResponse } from "next/server";
import { BLOGGER_COOKIE, destroyBloggerSession } from "@/lib/blogger-auth";
import { getClientIp, logAudit } from "@/lib/security";

export const runtime = "nodejs";

/** Blogger sign-out — deletes the server-side session, clears the cookie. */
export async function POST(req: Request) {
  await destroyBloggerSession();
  logAudit("blogger.logout", { actorType: "blogger", ip: getClientIp(req) });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(BLOGGER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
