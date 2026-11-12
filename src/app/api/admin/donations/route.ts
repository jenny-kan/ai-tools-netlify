import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminAuthenticated, unauthorized } from "@/lib/admin-auth";
import { serverError } from "@/lib/route-errors";
import type { DonationDTO, DonationStatus } from "@/lib/types";

export const runtime = "nodejs";

/** Admin: all donations + totals for the Donations tab. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return unauthorized();

  try {
    const donations = await db.donation.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

    const dtos: DonationDTO[] = donations.map((d) => ({
      id: d.id,
      donorName: d.donorName,
      email: d.email,
      amountCents: d.amountCents,
      currency: d.currency,
      message: d.message,
      status: d.status as DonationStatus,
      provider: d.provider,
      createdAt: d.createdAt.toISOString(),
    }));

    const completed = dtos.filter((d) => d.status === "COMPLETED");
    return NextResponse.json({
      donations: dtos,
      totals: {
        completedCount: completed.length,
        completedCents: completed.reduce((sum, d) => sum + d.amountCents, 0),
        pendingCount: dtos.filter((d) => d.status === "PENDING").length,
      },
    });
  } catch (e) {
    return serverError("Loading donations", e);
  }
}
