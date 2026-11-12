import { NextResponse } from "next/server";
import { getSessionBlogger } from "@/lib/blogger-auth";

export const runtime = "nodejs";

/** Who am I? Returns the signed-in blogger or { authenticated: false }. */
export async function GET() {
  const blogger = await getSessionBlogger();
  if (!blogger || blogger.status !== "APPROVED") {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({
    authenticated: true,
    blogger: { id: blogger.id, name: blogger.name, email: blogger.email, status: blogger.status },
  });
}
