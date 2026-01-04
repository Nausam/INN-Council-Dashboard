/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const revalidate = 0;

import ApplyWasteDefaultsButton from "@/components/waste/apply-waste-defaults-button";
import WasteCustomersTable from "@/components/waste/waste-customers-table";
import { listWasteCustomersWithSubs } from "@/lib/billing/waste.actions";

export default async function WasteCustomersPage() {
  const { customers } = await listWasteCustomersWithSubs(500);

  const total = customers.length;
  const withFee = customers.filter((r: any) => !!r.subscription).length;
  const withoutFee = total - withFee;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-10 md:px-6 mt-20">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Waste Management <span className="text-muted-foreground">•</span>{" "}
            Customers
          </h1>
          <p className="text-sm text-muted-foreground">
            Set each customer’s waste fee and billing frequency.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Total customers</div>
          <div className="mt-1 text-2xl font-semibold">{total}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Fee set</div>
          <div className="mt-1 text-2xl font-semibold">{withFee}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Fee not set</div>
          <div className="mt-1 text-2xl font-semibold">{withoutFee}</div>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4 md:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Customers list</div>
              <div className="text-xs text-muted-foreground">
                Search, set fees, and manage subscriptions.
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-end justify-end gap-2 mt-5">
          <ApplyWasteDefaultsButton />
        </div>
        <WasteCustomersTable initialRows={customers as any} />
      </div>
    </div>
  );
}
