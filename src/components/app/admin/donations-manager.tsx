"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Heart, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminDonations } from "@/lib/api";
import {
  DONATION_STATUS_LABELS,
  formatDate,
  type DonationStatus,
  type DonationsAdminResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<DonationStatus, string> = {
  PENDING: "border-amber-300/60 text-amber-700 dark:border-amber-700/60 dark:text-amber-300",
  COMPLETED: "border-emerald-300/60 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-300",
  CANCELLED: "border-border text-muted-foreground",
};

function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatusBadge({ status }: { status: DonationStatus }) {
  return (
    <Badge variant="outline" className={cn("font-normal", STATUS_STYLES[status])}>
      {DONATION_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Admin view of supporter donations (demo-mode payments are simulated client-side). */
export function DonationsManager() {
  const [data, setData] = useState<DonationsAdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await getAdminDonations());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load donations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const donations = useMemo(
    () => [...(data?.donations ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data]
  );

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading donations">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border bg-card" aria-hidden="true" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">{loadError ?? "Donations data is unavailable."}</p>
        <Button variant="outline" onClick={() => void load()} className="mt-3">
          Try again
        </Button>
      </div>
    );
  }

  const pending = data.totals.pendingCount;

  return (
    <div className="space-y-4">
      {/* header */}
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Heart className="size-4 text-primary" aria-hidden="true" />
          Donations
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Supporter contributions collected through the donate page.
        </p>
      </div>

      {/* summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Heart className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold leading-none">
                {formatAmount(data.totals.completedCents)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Raised (completed)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none">{data.totals.completedCount.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">Completed donations</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("py-4", pending > 0 && "border-amber-300/60 dark:border-amber-700/50")}>
          <CardContent className="flex items-center gap-3 px-4">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                pending > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-primary/10 text-primary"
              )}
            >
              <Clock className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none">{pending.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* donations table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All donations</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        {donations.length === 0 ? (
          <CardContent>
            <div className="rounded-xl border border-dashed p-10 text-center">
              <Heart className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 font-medium">No donations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">The donate page is live and waiting.</p>
            </div>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{d.donorName}</p>
                      <p className="text-xs text-muted-foreground">{d.email}</p>
                    </TableCell>
                    <TableCell className="font-semibold">{formatAmount(d.amountCents)}</TableCell>
                    <TableCell className="max-w-xs whitespace-normal">
                      {d.message ? (
                        <p className="line-clamp-1 text-sm text-muted-foreground">{d.message}</p>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{d.provider}</TableCell>
                    <TableCell className="whitespace-normal text-sm text-muted-foreground">
                      {formatDate(d.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* demo-mode note */}
      <Alert>
        <Info className="size-4" aria-hidden="true" />
        <AlertTitle>Demo mode</AlertTitle>
        <AlertDescription>
          Payments are simulated client-side. For production, set{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">DONATE_PROVIDER_URL</code> and
          connect the provider’s webhook to the{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/api/donations</code> endpoint.
        </AlertDescription>
      </Alert>
    </div>
  );
}
