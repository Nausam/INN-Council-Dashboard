/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function money(v: any) {
  return Number(v ?? 0);
}

export default function ReceiptPdf({
  payment,
  allocations,
}: {
  payment: any;
  allocations: { allocation: any; invoice: any | null }[];
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [busy, setBusy] = React.useState(false);

  const allocatedTotal = allocations.reduce(
    (s, a) => s + Number(a.allocation?.allocatedMvr ?? 0),
    0
  );
  const unallocated = Math.max(0, money(payment.amountMvr) - allocatedTotal);

  const customerName =
    allocations.find((a) => a.invoice?.customerName)?.invoice?.customerName ??
    "Customer";

  const customerAddress =
    allocations.find((a) => a.invoice?.customerAddress)?.invoice
      ?.customerAddress ?? "";

  async function downloadPdf() {
    if (!wrapRef.current) return;

    setBusy(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const filename = `RECEIPT-${String(payment.$id).slice(-6)}.pdf`;

      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(wrapRef.current).save();
    } finally {
      setBusy(false);
    }
  }

  function printView() {
    if (!wrapRef.current) return;

    const html = wrapRef.current.innerHTML;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;

    w.document.open();
    w.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: Arial, sans-serif; color: #111; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 0; font-size: 12px; }
            th { text-align: left; font-size: 12px; color: #111; }
            .muted { color: #555; }
          </style>
        </head>
        <body>
          ${html}
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    w.document.close();
  }

  const COUNCIL = {
    name: "Innamaadhoo Council",
    address: "R. Innamaadhoo",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={printView}>
          Print
        </Button>
        <Button onClick={downloadPdf} disabled={busy}>
          {busy ? "Generating..." : "Download PDF"}
        </Button>
      </div>

      <div
        ref={wrapRef}
        className="rounded-2xl border bg-white p-6 text-black shadow-sm"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="text-lg font-semibold">{COUNCIL.name}</div>
            <div className="text-sm text-neutral-600">{COUNCIL.address}</div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-semibold">RECEIPT</div>
            <div className="mt-1 text-sm text-neutral-600">
              Receipt ID:{" "}
              <span className="font-medium text-black">{payment.$id}</span>
            </div>
            <div className="text-sm text-neutral-600">
              Date:{" "}
              <span className="text-black">{fmtDate(payment.receivedAt)}</span>
            </div>
          </div>
        </div>

        <div className="my-5 h-px bg-neutral-200" />

        {/* Customer + Payment */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold tracking-wide text-neutral-500">
              RECEIVED FROM
            </div>
            <div className="mt-2 space-y-1">
              <div className="font-medium" dir="rtl">
                {customerName}
              </div>
              {customerAddress ? (
                <div className="text-sm text-neutral-700" dir="rtl">
                  {customerAddress}
                </div>
              ) : null}
              <div className="text-sm text-neutral-700">
                Customer ID: {payment.customerId}
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-xs font-semibold tracking-wide text-neutral-500">
              PAYMENT DETAILS
            </div>
            <div className="mt-2 space-y-1">
              <div className="text-sm text-neutral-700">
                Method:{" "}
                <span className="font-medium text-black">{payment.method}</span>
              </div>
              {payment.reference ? (
                <div className="text-sm text-neutral-700">
                  Reference:{" "}
                  <span className="text-black">{payment.reference}</span>
                </div>
              ) : null}
              <div className="text-sm text-neutral-700">
                Amount:{" "}
                <span className="font-semibold text-black">
                  MVR {money(payment.amountMvr)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="my-5 h-px bg-neutral-200" />

        {/* Allocations */}
        <div className="text-xs font-semibold tracking-wide text-neutral-500">
          ALLOCATIONS
        </div>

        <div className="mt-3">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th style={{ width: 110 }}>Period</th>
                <th style={{ width: 120, textAlign: "right" }}>Allocated</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => {
                const inv = a.invoice;
                const alloc = a.allocation;
                return (
                  <tr key={alloc.$id}>
                    <td>
                      {inv ? (
                        <>
                          <div style={{ fontWeight: 600 }}>{inv.invoiceNo}</div>
                          <div className="muted" style={{ fontSize: 11 }}>
                            Waste Management
                          </div>
                        </>
                      ) : (
                        <div style={{ fontWeight: 600 }}>
                          Invoice {String(alloc.invoiceId)}
                        </div>
                      )}
                    </td>
                    <td>{inv?.periodMonth ?? "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      MVR {money(alloc.allocatedMvr)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="my-5 h-px bg-neutral-200" />

        {/* Totals */}
        <div className="ml-auto w-full max-w-sm space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-neutral-600">Allocated</div>
            <div className="font-medium">MVR {allocatedTotal}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-neutral-600">Unallocated</div>
            <div className="font-medium">MVR {unallocated}</div>
          </div>

          <div className="flex items-center justify-between border-t pt-2">
            <div className="font-semibold">Total received</div>
            <div className="text-base font-semibold">
              MVR {money(payment.amountMvr)}
            </div>
          </div>
        </div>

        {payment.notes ? (
          <>
            <div className="my-5 h-px bg-neutral-200" />
            <div className="text-xs font-semibold tracking-wide text-neutral-500">
              NOTES
            </div>
            <div className="mt-2 text-sm text-neutral-700">{payment.notes}</div>
          </>
        ) : null}

        <div className="my-6 h-px bg-neutral-200" />
        <div className="text-xs text-neutral-600">
          This receipt was generated by the council system. Please keep it for
          your records.
        </div>
      </div>
    </div>
  );
}
