/* eslint-disable @typescript-eslint/no-explicit-any */

import { fmtMoney } from "@/components/landRent/Statement/landRentStatement.utils";

export type MonthlyFineRow = {
  key: string;
  label: string;
  dueDate: string | null;
  rent: number | null;
  days: number;
  fine: number;
  /** A whole period rather than a single month. */
  summary?: boolean;
  /** Flat fine per overdue month instead of a daily rate. */
  fixed?: boolean;
  needsRecalc?: boolean;
};

/**
 * Month-by-month fines of a statement or preview. Fines before Aug 2025 are one
 * continuous period, and statements saved before the monthly detail existed
 * only have their total.
 */
export function buildMonthlyFineRows(source: any): MonthlyFineRow[] {
  const fineBreakdown = Array.isArray(source?.fineBreakdown) ? source.fineBreakdown : [];
  const generatedRows = Array.isArray(source?.generatedAdjustmentRows)
    ? source.generatedAdjustmentRows
    : [];

  return [
    ...fineBreakdown.flatMap((row: any): MonthlyFineRow[] => {
      const whole: MonthlyFineRow = {
        key: `period-${row.key}`,
        label: String(row.label ?? ""),
        dueDate: null,
        rent: null,
        days: Number(row.days ?? 0),
        fine: Number(row.fine ?? 0),
        summary: true,
        needsRecalc: row.key === "continuous-fine-period",
      };
      if (!Array.isArray(row.months) || !row.months.length) return [whole];
      const months: MonthlyFineRow[] = row.months.map((m: any) => ({
        key: `${row.key}-${m.key}`,
        label: String(m.label ?? m.key),
        dueDate: m.dueDate || null,
        rent: Number(m.rent ?? 0) > 0 ? Number(m.rent) : null,
        days: Number(m.days ?? 0),
        fine: Number(m.fine ?? 0),
      }));
      // A later correction to the saved total is shown as its own line.
      const extraDays = whole.days - months.reduce((s, m) => s + m.days, 0);
      const extraFine = whole.fine - months.reduce((s, m) => s + m.fine, 0);
      if (extraDays !== 0 || Math.abs(extraFine) >= 0.01) {
        months.push({
          key: `${row.key}-adjustment`,
          label: "Older fine adjustment",
          dueDate: null,
          rent: null,
          days: extraDays,
          fine: Math.round(extraFine * 100) / 100,
          summary: true,
        });
      }
      return months;
    }),
    ...generatedRows.flatMap((row: any): MonthlyFineRow[] =>
      Array.isArray(row.months) && row.months.length
        ? row.months.map((m: any) => ({
            key: `${row.key}-${m.key}`,
            label: String(m.label ?? m.key),
            dueDate: m.dueDate ?? null,
            rent: Number(m.rent ?? 0),
            days: Number(m.days ?? 0),
            fine: Number(m.fine ?? 0),
            fixed: row.key === "generated-fixed-monthly-fine",
          }))
        : [{
            key: `period-${row.key}`,
            label: String(row.periodLabel ?? ""),
            dueDate: null,
            rent: null,
            days: Number(row.fineDays ?? 0),
            fine: Number(row.fineAmount ?? 0),
            summary: true,
            needsRecalc: true,
          }]
    ),
  ];
}

export function ProgressBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

/** The Monthly Fines table on the statement page. */
export default function MonthlyFinesSection({ rows }: { rows: MonthlyFineRow[] }) {
  if (!rows.length) return null;

  const totalFine = rows.reduce((sum, r) => sum + r.fine, 0);
  const totalDays = rows.reduce((sum, r) => sum + r.days, 0);
  const monthCount = rows.filter((r) => !r.summary).length;
  const maxFine = Math.max(1, ...rows.map((r) => r.fine));
  const needsRecalc = rows.some((r) => r.needsRecalc);

  return (
    <div className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-900">Monthly Fines</div>
          <div className="mt-1 text-sm text-slate-500">
            Fine charged on each unpaid month, from the day after its due date
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {monthCount > 0 ? (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-[12px] font-semibold text-violet-700 ring-1 ring-violet-100">
                {monthCount} {monthCount === 1 ? "month" : "months"} fined
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200">
              {totalDays} fine days
            </span>
          </div>
        </div>

        <div className="sm:text-right">
          <div className="text-[12px] font-semibold text-slate-500">Calculated fines</div>
          <div className="mt-1 inline-flex rounded-xl bg-violet-100 px-3 py-2 font-semibold tabular-nums text-violet-700 ring-1 ring-violet-200">
            {fmtMoney(totalFine)}
          </div>
        </div>
      </div>

      {needsRecalc ? (
        <div className="mx-5 mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
          This statement was saved before month-by-month fines were kept. Use Recalculate all to see each month.
        </div>
      ) : null}

      <div className="h-px bg-slate-100" />

      <div className="max-h-[480px] overflow-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-left text-[12px] font-semibold text-slate-500">
              <th className="px-5 py-3">Month</th>
              <th className="px-3 py-3">Due date</th>
              <th className="px-3 py-3 text-right">Rent</th>
              <th className="px-3 py-3 text-right">Days overdue</th>
              <th className="px-3 py-3 text-right">Per day</th>
              <th className="px-3 py-3 w-[18%]"></th>
              <th className="px-5 py-3 text-right">Fine</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const perDay = !r.fixed && r.days > 0 ? r.fine / r.days : null;
              const pct = Math.max(4, Math.round((r.fine / maxFine) * 100));
              return (
                <tr key={r.key} className={r.summary ? "bg-slate-50/70" : "hover:bg-slate-50/60"}>
                  <td className="px-5 py-3">
                    <span dir="auto" className={`font-semibold text-slate-900 ${r.summary ? "font-dh1 font-medium" : ""}`}>
                      {r.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-600">{r.dueDate ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                    {r.rent == null ? "—" : fmtMoney(r.rent)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-900">
                    {r.fixed ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                        Fixed
                      </span>
                    ) : (
                      r.days
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                    {perDay == null ? "—" : fmtMoney(perDay)}
                  </td>
                  <td className="px-3 py-3">
                    <ProgressBar pct={pct} />
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {fmtMoney(r.fine)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-violet-50/60 font-semibold text-slate-900">
              <td className="px-5 py-3" colSpan={3}>Total</td>
              <td className="px-3 py-3 text-right tabular-nums">{totalDays}</td>
              <td className="px-3 py-3" colSpan={2}></td>
              <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(totalFine)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Same green as the council statement. */
const COUNCIL_GREEN = "#0f4b45";

/**
 * The Monthly Fines page added to the end of a statement PDF, in the look of
 * the council statement. Uses rem sizes and plain block text, because
 * html2canvas pushes text down inside padded inline-flex pills.
 */
export function MonthlyFinesPrintPage({
  rows,
  details,
  asOf,
}: {
  rows: MonthlyFineRow[];
  /** Lease details shown above the table, in order. */
  details: Array<{ label: string; value: string; dhivehi?: boolean }>;
  /** When the fines were calculated up to, as YYYY-MM-DD. */
  asOf: string;
}) {
  if (!rows.length) return null;

  const totalFine = rows.reduce((sum, r) => sum + r.fine, 0);
  const totalDays = rows.reduce((sum, r) => sum + r.days, 0);
  const monthCount = rows.filter((r) => !r.summary).length;
  const maxFine = Math.max(1, ...rows.map((r) => r.fine));
  const dailyRates = rows
    .filter((r) => !r.fixed && !r.summary && r.days > 0)
    .map((r) => Math.round((r.fine / r.days) * 100) / 100);
  const sameRate = dailyRates.length > 0 && dailyRates.every((rate) => rate === dailyRates[0]);

  const tiles = [
    {
      label: "Months fined",
      value: String(monthCount),
      note: monthCount === 1 ? "unpaid month" : "unpaid months",
    },
    { label: "Fine days", value: String(totalDays), note: "days overdue in total" },
    {
      label: "Daily fine",
      value: sameRate ? fmtMoney(dailyRates[0]) : "Varies",
      note: sameRate ? "per day, on each month" : "see each month",
    },
  ];

  return (
    <div className="rounded-3xl bg-white p-8 ring-1 ring-black/10">
      {/* Title bar */}
      <div className="rounded-2xl px-6 py-5" style={{ backgroundColor: COUNCIL_GREEN }}>
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-2xl font-semibold leading-tight text-white">Monthly Fines</div>
            <div className="mt-1.5 text-sm leading-normal text-white/75">
              Fine charged on each unpaid month, from the day after its due date
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase leading-normal tracking-wider text-white/70">
              Total fines
            </div>
            <div className="mt-1 text-3xl font-bold leading-tight tabular-nums text-white">
              {fmtMoney(totalFine)}
            </div>
          </div>
        </div>
      </div>

      {/* Lease details */}
      <div className="mt-6 grid grid-cols-4 overflow-hidden rounded-2xl ring-1 ring-black/10">
        {details.map((d, i) => (
          <div key={d.label} className={`px-4 py-3.5 ${i > 0 ? "border-l border-black/10" : ""}`}>
            <div className="text-xs font-semibold uppercase leading-normal tracking-wider text-slate-500">
              {d.label}
            </div>
            <div
              dir={d.dhivehi ? "rtl" : "ltr"}
              className={`mt-1 text-base font-semibold leading-relaxed text-slate-900 ${
                d.dhivehi ? "text-left font-dh1" : "tabular-nums"
              }`}
            >
              {d.value || "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Summary tiles */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-emerald-50/70 px-5 py-4 ring-1 ring-emerald-100">
            <div className="text-xs font-semibold uppercase leading-normal tracking-wider text-emerald-800/70">
              {t.label}
            </div>
            <div className="mt-1 text-2xl font-bold leading-tight tabular-nums" style={{ color: COUNCIL_GREEN }}>
              {t.value}
            </div>
            <div className="mt-0.5 text-xs leading-normal text-slate-500">{t.note}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-black/15">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-white" style={{ backgroundColor: COUNCIL_GREEN }}>
              <th className="px-4 py-3.5 text-left font-semibold leading-normal">Month</th>
              <th className="px-3 py-3.5 text-left font-semibold leading-normal">Due date</th>
              <th className="px-3 py-3.5 text-right font-semibold leading-normal">Rent</th>
              <th className="px-3 py-3.5 text-right font-semibold leading-normal">Days overdue</th>
              <th className="px-3 py-3.5 text-right font-semibold leading-normal">Per day</th>
              <th className="w-[16%] px-3 py-3.5"></th>
              <th className="px-4 py-3.5 text-right font-semibold leading-normal">Fine</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const perDay = !r.fixed && r.days > 0 ? r.fine / r.days : null;
              const pct = Math.max(3, Math.round((r.fine / maxFine) * 100));
              return (
                <tr
                  key={r.key}
                  className={`avoid-break border-t border-black/[0.06] leading-normal ${
                    r.summary ? "bg-amber-50/60" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div dir="auto" className={`font-semibold text-slate-900 ${r.summary ? "font-dh1 font-medium" : ""}`}>
                      {r.label}
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-600">{r.dueDate ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                    {r.rent == null ? "—" : fmtMoney(r.rent)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {r.fixed ? "Fixed" : r.days}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                    {perDay == null ? "—" : fmtMoney(perDay)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {fmtMoney(r.fine)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr
              className="border-t-2 border-emerald-900/20 bg-emerald-50 font-bold leading-normal"
              style={{ color: COUNCIL_GREEN }}
            >
              <td className="px-4 py-3.5" colSpan={3}>Total</td>
              <td className="px-3 py-3.5 text-right tabular-nums">{totalDays}</td>
              <td className="px-3 py-3.5" colSpan={2}></td>
              <td className="px-4 py-3.5 text-right text-base tabular-nums">{fmtMoney(totalFine)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 text-xs leading-relaxed text-slate-500">
        Fines calculated up to {asOf}.
        {rows.some((r) => r.fixed) ? null : " Each month's fine is its days overdue multiplied by the daily fine."}
      </div>
    </div>
  );
}
