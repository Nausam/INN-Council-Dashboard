"use client";

import { CalendarDays, Download, Eye, FileText, User2 } from "lucide-react";
import Link from "next/link";
import {
  buildStatementHref,
  fmtDateShort,
  fmtMoney,
  getOutstandingNow,
  LandRentOverviewUIRow,
} from "./landRentOverview.utils";
import {
  getAgreementPdfUrl,
  getAgreementPdfDownloadUrl,
} from "@/lib/landrent/landRent.actions";

export default function OverviewCards({
  rows,
  monthKey,
}: {
  rows: LandRentOverviewUIRow[];
  monthKey: string;
}) {
  return (
    <div className="md:hidden grid gap-3">
      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-black/10 p-6 text-sm text-muted-foreground">
          No results.
        </div>
      ) : (
        rows.map((r) => (
          <div
            key={r.leaseId}
            className="relative rounded-2xl p-[1px] bg-gradient-to-br from-black/10 to-black/5"
          >
            <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-sm">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_400px_at_15%_-10%,rgba(0,0,0,.04),transparent_60%)]" />

              <div className="relative p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold font-dh1 truncate">
                      {r.landName ?? "-"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground font-dh1 truncate">
                      {r.tenantName ?? "-"}
                    </div>
                  </div>

                  <Link
                    href={buildStatementHref(r.leaseId, monthKey)}
                    className="shrink-0 inline-flex items-center gap-2 h-10 rounded-2xl bg-black text-white px-4 text-sm font-semibold
                      ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <FileText className="h-4 w-4" />
                    Statement
                  </Link>
                </div>

                <div className="mt-3 grid gap-2 text-xs">
                  <div className="flex items-center gap-2 text-black/70">
                    <User2 className="h-4 w-4" />
                    <span className="truncate">{r.agreementNumber ?? "-"}</span>
                  </div>

                  {r.agreementPdfFileId ? (
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1 rounded-xl bg-black/[0.03] ring-1 ring-black/10 px-2 py-1 text-[11px] text-black/70">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[180px]">
                          {r.agreementPdfFilename ?? "Agreement.pdf"}
                        </span>
                      </div>

                      <a
                        href={getAgreementPdfUrl(r.agreementPdfFileId)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 h-8 rounded-xl bg-white px-3 text-[11px] font-semibold
        ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </a>

                      <a
                        href={getAgreementPdfDownloadUrl(r.agreementPdfFileId)}
                        className="inline-flex items-center gap-1 h-8 rounded-xl bg-black text-white px-3 text-[11px] font-semibold
        ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">
                      No agreement uploaded
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-black/70">
                    <CalendarDays className="h-4 w-4" />
                    <span className="tabular-nums">
                      {fmtDateShort(r.startDate)} → {fmtDateShort(r.endDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="rounded-xl bg-black/[0.03] ring-1 ring-black/10 px-3 py-2">
                      <div className="text-[10px] text-muted-foreground">
                        Monthly
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {fmtMoney(Number(r.monthlyRent ?? 0))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-black/[0.03] ring-1 ring-black/10 px-3 py-2">
                      <div className="text-[10px] text-muted-foreground">
                        Outstanding
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {fmtMoney(getOutstandingNow(r))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 text-[11px] text-muted-foreground">
                    Last paid:{" "}
                    <span className="tabular-nums text-black/70">
                      {fmtDateShort(r.lastPaymentDate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      <div className="text-xs text-muted-foreground px-1">
        Total: {rows.length}
      </div>
    </div>
  );
}
