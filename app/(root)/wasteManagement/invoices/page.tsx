/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const revalidate = 0;

import WasteInvoicesTable from "@/components/waste/waste-invoices-table";
import WasteInvoicesToolbar from "@/components/waste/waste-invoices-toolbar";
import {
  getWasteInvoiceSummary,
  listWasteCustomersLight,
  listWasteInvoices,
} from "@/lib/billing/waste.actions";

function ymNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default async function WasteInvoicesPage({
  searchParams,
}: {
  searchParams?: { month?: string; status?: string; customerId?: string };
}) {
  const month = searchParams?.month?.trim() || ymNow();
  const status = (searchParams?.status?.trim() || "ALL") as any;
  const customerId = searchParams?.customerId?.trim() || "";

  const invoices = await listWasteInvoices({
    periodMonth: month,
    status: status === "ALL" ? undefined : status,
    customerId: customerId || undefined,
    limit: 200,
  });

  const summary = await getWasteInvoiceSummary({ periodMonth: month });
  const customers = await listWasteCustomersLight({ limit: 500 });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-10 md:px-6 mt-20">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Waste Management <span className="text-muted-foreground">•</span>{" "}
          Invoices
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate monthly invoices and track payment status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Invoices</div>
          <div className="mt-1 text-2xl font-semibold">{summary.total}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">
            Total billed (MVR)
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {summary.totalAmount}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Paid (MVR)</div>
          <div className="mt-1 text-2xl font-semibold">{summary.totalPaid}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Outstanding (MVR)</div>
          <div className="mt-1 text-2xl font-semibold">
            {summary.totalBalance}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4 md:p-5">
          <WasteInvoicesToolbar
            initialMonth={month}
            initialStatus={status}
            initialCustomerId={customerId}
            customers={customers as any[]}
          />
        </div>

        <WasteInvoicesTable invoices={invoices} />
      </div>
    </div>
  );
}
