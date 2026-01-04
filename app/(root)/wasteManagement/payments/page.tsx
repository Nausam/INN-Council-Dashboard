export const dynamic = "force-dynamic";
export const revalidate = 0;

import WastePaymentsPanel from "@/components/waste/waste-payments-panel";
import { listWasteCustomersLight } from "@/lib/billing/waste.actions";

export default async function WastePaymentsPage() {
  const customers = await listWasteCustomersLight({ limit: 500 });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-10 md:px-6 mt-20">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Waste Management <span className="text-muted-foreground">•</span>{" "}
          Payments
        </h1>
        <p className="text-sm text-muted-foreground">
          Record manual payments and automatically settle oldest invoices.
        </p>
      </div>

      <WastePaymentsPanel customers={customers} />
    </div>
  );
}
