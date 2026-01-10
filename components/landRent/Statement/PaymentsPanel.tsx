/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { fmtMoney } from "@/components/landRent/Statement/landRentStatement.utils";

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
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900 tabular-nums">
                      {fmtDateTime(iso)}
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-100">
                      {method}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-500 tabular-nums">
                    {ref ? `Ref: ${ref}` : " "}
                    {receivedBy ? (
                      <>
                        <span className="mx-2 text-slate-300">•</span>
                        Received by: {receivedBy}
                      </>
                    ) : null}
                  </div>

                  {note ? (
                    <div className="mt-2 text-xs text-slate-600 font-dh1">
                      {note}
                    </div>
                  ) : null}

                  {/* <div className="mt-3">
                    <ProgressBar pct={pct} />
                  </div> */}
                </div>

                <div className="shrink-0 rounded-xl bg-white px-3 py-2 text-right ring-1 ring-slate-100">
                  <div className="text-[11px] text-slate-500">Amount</div>
                  <div className="font-semibold tabular-nums text-slate-900">
                    {fmtMoney(amount)}
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
