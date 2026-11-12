import { NextResponse } from "next/server";
import { ADMIN_DEMO_PASSWORD, adminAuthConfigured, isAdminAuthenticated } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * Session probe for the admin dashboard.
 *
 * The demo password is disclosed ONLY in development (so the demo sign-in
 * screen can offer "copy demo password"). In production nothing is disclosed,
 * and when ADMIN_PASSWORD/ADMIN_SECRET are missing the response says the
 * dashboard is disabled (fail closed) instead of authenticating anyone.
 */
export async function GET() {
  const configured = adminAuthConfigured();
  const usingDemo = !process.env.ADMIN_PASSWORD; // dev convenience only
  return NextResponse.json({
    authenticated: configured ? await isAdminAuthenticated() : false,
    disabled: !configured,
    ...(configured && usingDemo ? { demoPassword: ADMIN_DEMO_PASSWORD } : {}),
  });
}
