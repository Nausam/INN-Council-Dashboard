/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
export const revalidate = 0;

import ReceiptPdf from "@/components/waste/receipt-pdf";
import { getWastePaymentReceipt } from "@/lib/billing/waste.actions";

export default async function WastePaymentReceiptPage({
  params,
}: {
  params: { paymentId: string };
}) {
  const { payment, allocations } = await getWastePaymentReceipt(
    params.paymentId
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10 md:px-6 mt-20">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Payment Receipt
        </h1>
        <p className="text-sm text-muted-foreground">
          Receipt ID: {String((payment as any).$id)}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
        <ReceiptPdf
          payment={payment as any}
          allocations={allocations as any[]}
        />
      </div>
    </div>
  );
}
