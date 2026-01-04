/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Badge } from "@/components/ui/badge";
import InvoicePdf from "@/components/waste/invoice-pdf";
import { getWasteInvoiceWithItems } from "@/lib/billing/waste.actions";

export default async function WasteInvoiceDetailPage({
  params,
}: {
  params: { invoiceId: string };
}) {
  const { invoice, items } = await getWasteInvoiceWithItems(params.invoiceId);
  const inv: any = invoice;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10 md:px-6 mt-20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Invoice {String(inv.invoiceNo)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {String(inv.customerName)} • {String(inv.periodMonth)}
          </p>
        </div>

        <Badge variant="outline">{String(inv.status)}</Badge>
      </div>

      {/* Quick totals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="mt-1 text-2xl font-semibold">
            MVR {Number(inv.totalMvr ?? 0)}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Paid</div>
          <div className="mt-1 text-2xl font-semibold">
            MVR {Number(inv.paidMvr ?? 0)}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className="mt-1 text-2xl font-semibold">
            MVR {Number(inv.balanceMvr ?? 0)}
          </div>
        </div>
      </div>

      {/* PDF + Preview content */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
        <InvoicePdf invoice={inv} items={items as any[]} />
      </div>
    </div>
  );
}
