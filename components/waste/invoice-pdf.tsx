/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function money(n: any) {
  return Number(n ?? 0);
}

export default function InvoicePdf({
  invoice,
  items,
}: {
  invoice: any;
  items: any[];
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function downloadPdf() {
    if (!wrapRef.current) return;

    setBusy(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const filename = `${invoice?.invoiceNo || "invoice"}.pdf`;

      const opt = {
        margin: [10, 10, 10, 10], // mm
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
          <title>${invoice?.invoiceNo || "Invoice"}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: Arial, sans-serif; color: #111; }
            .a4 { width: 210mm; }
            .muted { color: #555; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 0; font-size: 12px; }
            th { text-align: left; font-size: 12px; color: #111; }
          </style>
        </head>
        <body>
          <div class="a4">${html}</div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    w.document.close();
  }

  // You can later move these to Settings in your DB
  const COUNCIL = {
    name: "Innamaadhoo Council",
    address: "R. Innamaadhoo",
    phone: "",
    email: "",
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

      {/* This is the exact content used for PDF/Print */}
      <div
        ref={wrapRef}
        className="rounded-2xl border bg-white p-6 text-black shadow-sm"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="text-lg font-semibold">{COUNCIL.name}</div>
            <div className="text-sm text-neutral-600">{COUNCIL.address}</div>
            {COUNCIL.phone ? (
              <div className="text-sm text-neutral-600">{COUNCIL.phone}</div>
            ) : null}
            {COUNCIL.email ? (
              <div className="text-sm text-neutral-600">{COUNCIL.email}</div>
            ) : null}
          </div>

          <div className="text-right">
            <div className="text-2xl font-semibold">INVOICE</div>
            <div className="mt-1 text-sm text-neutral-600">
              Invoice No:{" "}
              <span className="font-medium text-black">
                {invoice.invoiceNo}
              </span>
            </div>
            <div className="text-sm text-neutral-600">
              Issue date:{" "}
              <span className="text-black">{fmtDate(invoice.issueDate)}</span>
            </div>
            <div className="text-sm text-neutral-600">
              Due date:{" "}
              <span className="text-black">{fmtDate(invoice.dueDate)}</span>
            </div>
          </div>
        </div>

        <div className="my-5 h-px bg-neutral-200" />

        {/* Bill to */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold tracking-wide text-neutral-500">
              BILL TO
            </div>
            <div className="mt-2 space-y-1">
              <div className="font-medium" dir="rtl">
                {invoice.customerName}
              </div>
              <div className="text-sm text-neutral-700" dir="rtl">
                {invoice.customerAddress}
              </div>
              <div className="text-sm text-neutral-700">
                ID: {invoice.customerIdCardNumber}
              </div>
              <div className="text-sm text-neutral-700">
                Period: {invoice.periodMonth}
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-xs font-semibold tracking-wide text-neutral-500">
              SERVICE
            </div>
            <div className="mt-2 space-y-1">
              <div className="font-medium">Waste Management</div>
              <div className="text-sm text-neutral-700">
                Payment status:{" "}
                <span className="font-medium text-black">{invoice.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="my-5 h-px bg-neutral-200" />

        {/* Items */}
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style={{ width: 80, textAlign: "right" }}>Qty</th>
              <th style={{ width: 120, textAlign: "right" }}>Unit</th>
              <th style={{ width: 140, textAlign: "right" }}>Line total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.$id}>
                <td>{it.label}</td>
                <td style={{ textAlign: "right" }}>{Number(it.qty ?? 1)}</td>
                <td style={{ textAlign: "right" }}>MVR {money(it.unitMvr)}</td>
                <td style={{ textAlign: "right" }}>
                  MVR {money(it.lineTotalMvr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-5 h-px bg-neutral-200" />

        {/* Totals */}
        <div className="ml-auto w-full max-w-sm space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-neutral-600">Subtotal</div>
            <div className="font-medium">MVR {money(invoice.subtotalMvr)}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-neutral-600">Discount</div>
            <div className="font-medium">MVR {money(invoice.discountMvr)}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-neutral-600">Penalty</div>
            <div className="font-medium">MVR {money(invoice.penaltyMvr)}</div>
          </div>

          <div className="flex items-center justify-between border-t pt-2">
            <div className="font-semibold">Total</div>
            <div className="text-base font-semibold">
              MVR {money(invoice.totalMvr)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-neutral-600">Paid</div>
            <div className="font-medium">MVR {money(invoice.paidMvr)}</div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-neutral-600">Balance</div>
            <div className="text-base font-semibold">
              MVR {money(invoice.balanceMvr)}
            </div>
          </div>
        </div>

        <div className="my-6 h-px bg-neutral-200" />

        {/* Footer note */}
        <div className="text-xs text-neutral-600">
          Payment is recorded manually by the council (cash / transfer /
          cheque). Please keep your receipt.
        </div>
      </div>
    </div>
  );
}
