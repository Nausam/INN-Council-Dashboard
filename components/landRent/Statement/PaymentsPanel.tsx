/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { fmtMoney } from "@/components/landRent/Statement/landRentStatement.utils";
import {
  getPaymentSlipDownloadUrl,
  getPaymentSlipUrl,
} from "@/lib/landrent/landRent.actions";
import { Download, Eye } from "lucide-react";

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function getPayIso(p: any): string | null {
  return (
    p?.payAt ??
    p?.paidAt ??
    p?.paidAtIso ??
    p?.createdAt ??
    p?.$createdAt ??
    null
  );
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProgressBar({ pct }: { pct: number }) {
  const p = clampPct(pct);
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export default function PaymentsPanel({
  openStatement,
}: {
  openStatement: any | null;
}) {
  if (!openStatement) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <div className="text-sm font-semibold text-slate-900">
          No open statement
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Create a statement to start collecting payments.
        </div>
      </div>
    );
  }

  const raw =
    (openStatement as any)?.payments ??
    (openStatement as any)?.paymentsList ??
    (openStatement as any)?.pays ??
    [];

  const payments: any[] = Array.isArray(raw) ? raw : [];

  if (!payments.length) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <div className="text-sm font-semibold text-slate-900">
          No payments yet
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Add a payment from the form.
        </div>
      </div>
    );
  }

  const sorted = [...payments].sort((a, b) => {
    const ta = new Date(getPayIso(a) ?? 0).getTime();
    const tb = new Date(getPayIso(b) ?? 0).getTime();
    return tb - ta; // latest first
  });

  const totalPaid = sorted.reduce((sum, p) => sum + Number(p?.amount ?? 0), 0);

  const maxAmount = Math.max(
    1,
    ...sorted.map((p) => Number(p?.amount ?? 0) || 0)
  );

  return (
    <div className="max-h-[420px] overflow-auto">
      <div className="grid gap-3">
        {sorted.map((p, idx) => {
          const amount = Number(p?.amount ?? 0) || 0;
          const iso = getPayIso(p);
          const method = String(p?.method ?? "—");
          const ref = String(p?.reference ?? p?.ref ?? "").trim();
          const receivedBy = String(p?.receivedBy ?? "").trim();
          const note = String(p?.note ?? "").trim();

          const pct = Math.max(6, Math.round((amount / maxAmount) * 100));

          return (
            <div
              key={p?.$id ?? p?.id ?? `${iso ?? "x"}-${idx}`}
              className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"
            >
              <div className="flex items-center gap-4">
                {/* Left */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900 tabular-nums">
                      {fmtDateTime(iso)}
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-100">
                      {method}
                    </span>
                  </div>

                  {receivedBy ? (
                    <div className="mt-1 text-xs text-slate-500">
                      Received by: {receivedBy}
                    </div>
                  ) : null}
                </div>

                {/* Middle (note) */}
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  {note ? (
                    <div className="text-md text-slate-700 font-dh1 text-center line-clamp-2">
                      {note}
                    </div>
                  ) : null}
                </div>

                {/* Right */}
                <div className="shrink-0 flex items-center gap-3">
                  {p?.slipFileId ? (
                    <div className="flex items-center gap-2">
                      {/* View */}
                      <a
                        href={getPaymentSlipUrl(p.slipFileId)}
                        target="_blank"
                        rel="noreferrer"
                        title="View slip"
                        className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-white px-3 text-xs font-semibold
            ring-1 ring-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <Eye className="h-4 w-4 text-slate-700" />
                      </a>

                      {/* Download */}
                      <a
                        href={getPaymentSlipDownloadUrl(p.slipFileId)}
                        download={p?.slipFilename ?? "payment-slip"}
                        title="Download slip"
                        className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-slate-900 text-white px-3 text-xs font-semibold
            ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <Download className="h-4 w-4 text-white" />
                      </a>
                    </div>
                  ) : null}

                  <div className="rounded-xl bg-white px-3 py-2 text-right ring-1 ring-slate-100">
                    <div className="text-[11px] text-slate-500">Amount</div>
                    <div className="font-semibold tabular-nums text-slate-900">
                      {fmtMoney(amount)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
