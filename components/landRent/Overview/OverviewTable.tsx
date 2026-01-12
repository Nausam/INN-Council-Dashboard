"use client";

import {
  getAgreementPdfDownloadUrl,
  getAgreementPdfUrl,
} from "@/lib/landrent/landRent.actions";
import { Download, Eye, FileText, User2 } from "lucide-react";
import Link from "next/link";
import {
  buildStatementHref,
  fmtMoney,
  getOutstandingNow,
  LandRentOverviewUIRow,
} from "./landRentOverview.utils";

export default function OverviewTable({
  rows,
  monthKey,
}: {
  rows: LandRentOverviewUIRow[];
  monthKey: string;
}) {
  return (
    <div className="hidden md:block rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-3 font-semibold">Tenant</th>
              <th className="px-4 py-3 font-semibold">Agreement No</th>
              <th className="px-4 py-3 font-semibold">Agreement</th>
              <th className="px-4 py-3 font-semibold">Outstanding</th>
              <th className="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-slate-500" colSpan={4}>
                  No results.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.leaseId} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-lg font-dh1 text-slate-900/90">
                        {r.landName ?? "-"}
                      </div>
                      <div className="mt-2 text-md text-slate-500 font-dh1 truncate">
                        {r.tenantName ?? "-"}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex items-center rounded-xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-100">
                        <User2 className="mr-2 h-4 w-4 text-slate-500" />
                        <span className="tabular-nums text-slate-700">
                          {r.agreementNumber ?? "-"}
                        </span>
                      </span>
                    </div>
                  </td>

                  <td>
                    {r.agreementPdfFileId ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={getAgreementPdfUrl(r.agreementPdfFileId)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-white px-3 text-xs font-semibold
            ring-1 ring-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <Eye className="h-4 w-4 text-slate-600" />
                        </a>

                        <a
                          href={getAgreementPdfDownloadUrl(
                            r.agreementPdfFileId
                          )}
                          className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-slate-900 text-white px-3 text-xs font-semibold
            ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">
                        No agreement uploaded
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 tabular-nums font-semibold text-slate-900">
                    {fmtMoney(getOutstandingNow(r))}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Link
                        href={buildStatementHref(r.leaseId, monthKey)}
                        className="inline-flex items-center gap-2 h-10 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md
                          bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600"
                      >
                        <FileText className="h-4 w-4" />
                        Statement
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
        <span>Total: {rows.length}</span>
        <span className="tabular-nums">
          Month key used:{" "}
          <span className="font-semibold text-slate-900">{monthKey}</span>
        </span>
      </div>
    </div>
  );
}
