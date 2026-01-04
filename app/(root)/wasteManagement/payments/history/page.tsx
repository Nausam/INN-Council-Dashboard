/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const revalidate = 0;

import WastePaymentHistoryTable from "@/components/waste/waste-payment-history-table";
import WastePaymentHistoryToolbar from "@/components/waste/waste-payment-history-toolbar";
import { listWastePayments } from "@/lib/billing/waste.actions";

function ymNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default async function WastePaymentHistoryPage({
  searchParams,
}: {
  searchParams?: { month?: string; q?: string; method?: string };
}) {
  const month = searchParams?.month?.trim() || ymNow();
  const q = searchParams?.q?.trim() || "";
  const method = (searchParams?.method?.trim() || "ALL") as any;

  const { rows, summary } = await listWastePayments({
    month,
    q,
    method,
    limit: 200,
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-10 md:px-6 mt-20">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Waste Management <span className="text-muted-foreground">•</span>{" "}
          Payment History
        </h1>
        <p className="text-sm text-muted-foreground">
          Search payments and open receipts anytime.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Payments</div>
          <div className="mt-1 text-2xl font-semibold">{summary.count}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">
            Total received (MVR)
          </div>
          <div className="mt-1 text-2xl font-semibold">{summary.amount}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Allocated (MVR)</div>
          <div className="mt-1 text-2xl font-semibold">{summary.allocated}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Unallocated (MVR)</div>
          <div className="mt-1 text-2xl font-semibold">
            {summary.unallocated}
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4 md:p-5">
          <WastePaymentHistoryToolbar
            initialMonth={month}
            initialQ={q}
            initialMethod={method}
          />
        </div>

        <WastePaymentHistoryTable rows={rows} />
      </div>
    </div>
  );
}
