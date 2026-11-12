import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getClientIp, rateLimit } from "@/lib/security";
import {
  SourcePackageUnavailableError,
  buildSourcePackage,
  sourceDownloadPolicy,
} from "@/lib/source-package";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/download — streams the clean, deploy-ready source package
 * (zip, no secrets, no databases, no git history) to the browser.
 *
 * Access policy (see `sourceDownloadPolicy`):
 *   - development / SOURCE_DOWNLOAD_PUBLIC=true → public one-click download
 *   - production                                  → admin session required
 *
 * GET is non-mutating, so no CSRF check applies; downloads are rate-limited
 * per IP because zipping is real CPU work.
 */
export async function GET(req: Request) {
  if (sourceDownloadPolicy() === "admin" && !(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized — sign in to the admin dashboard to download the source package." },
      { status: 401 }
    );
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`download:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many downloads from this address — try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 3600) } }
    );
  }

  try {
    const { buffer, filename } = await buildSourcePackage();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof SourcePackageUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    console.error("[download] failed to build the source package:", err);
    return NextResponse.json({ error: "Could not build the source package." }, { status: 500 });
  }
}
