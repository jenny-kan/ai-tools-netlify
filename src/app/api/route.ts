import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Liveness/readiness probe for deploy platforms and uptime monitors. */
export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json(
    {
      status: "ok",
      database: dbOk ? "up" : "down",
      time: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 }
  );
}
