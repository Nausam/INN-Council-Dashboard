"use client";

import { AvatarGlow } from "@/components/design-system";
import type { CouncilMonthSummary } from "@/lib/attendance/council-month-summary";
import { cn } from "@/lib/utils";
import { maldivesTodayIso } from "@/lib/employees/details-dashboard";
import { Download, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "1 – 28 Oct 2026", "28 Sep – 3 Oct 2026" or across years in full. */
function rangeTitle(start: string, end: string): string {
  const format = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
  if (start === end) return format(start, { day: "numeric", month: "short", year: "numeric" });
  if (start.slice(0, 4) !== end.slice(0, 4)) {
    return `${format(start, { day: "numeric", month: "short", year: "numeric" })} – ${format(end, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${Number(start.slice(8))} – ${format(end, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return `${format(start, { day: "numeric", month: "short" })} – ${format(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

function monthBounds(year: number, month0: number): { start: string; end: string } {
  const first = new Date(Date.UTC(year, month0, 1));
  const last = new Date(Date.UTC(year, month0 + 1, 0));
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

/** Quick ranges, worked out from today's Maldives date. */
function presets(): Array<{ id: string; label: string; start: string; end: string }> {
  const [year, month] = maldivesTodayIso().split("-").map(Number);
  return [
    { id: "this", label: "This month", ...monthBounds(year, month - 1) },
    { id: "last", label: "Last month", ...monthBounds(year, month - 2) },
    { id: "year", label: "This year", start: `${year}-01-01`, end: `${year}-12-31` },
  ];
}

/**
 * Council attendance for a date range: each employee's days at the office
 * (out of the working days so far) and late minutes.
 */
export function CouncilReportsView({ summary }: { summary: CouncilMonthSummary }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [section, setSection] = useState("All");
  const [from, setFrom] = useState(summary.start);
  const [to, setTo] = useState(summary.end);
  const quickRanges = useMemo(presets, []);

  // Back to the shown range when another one has loaded.
  useEffect(() => {
    setFrom(summary.start);
    setTo(summary.end);
  }, [summary.start, summary.end]);

  const sections = useMemo(
    () => ["All", ...Array.from(new Set(summary.rows.map((row) => row.section).filter(Boolean)))],
    [summary.rows],
  );
  const rows = section === "All" ? summary.rows : summary.rows.filter((row) => row.section === section);
  const hasRecords = summary.rows.some((row) => row.daysAttended || row.leaveDays);
  const totalLate = rows.reduce((total, row) => total + row.lateMinutes, 0);
  const tracked = rows.filter((row) => row.tracked);
  const averageAttendance = tracked.length
    ? Math.round(tracked.reduce((total, row) => total + row.daysAttended, 0) / tracked.length)
    : 0;

  const showRange = (start: string, end: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return;
    if (start === summary.start && end === summary.end) return;
    startTransition(() => router.push(`${pathname}?from=${start}&to=${end}`));
  };
  const title = rangeTitle(summary.start, summary.end);

  const downloadCSV = () => {
    const header = ["Name", "Designation", "Section", "Days attended", "Working days", "Late minutes", "Late days", "Leave days"];
    const lines = rows.map((row) =>
      [row.name, row.designation, row.section, row.daysAttended, summary.workingDays, row.lateMinutes, row.lateDays, row.leaveDays]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Council_Attendance_${summary.start}_to_${summary.end}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 text-[#243635] sm:px-6 lg:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-5 border-b border-[#e4e9e6] pb-7">
        <div>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#408d75]">Reports / Council</p>
          <h1 className="text-4xl font-black tracking-[-0.045em] text-[#1b302e] sm:text-5xl">
            Council attendance<span className="text-[#8cc9b1]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[#84918e]">Days at the office and late minutes for each employee · {title}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadCSV}
            disabled={!hasRecords || pending}
            aria-label="Download CSV"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#17191d] px-4 text-sm font-extrabold text-white shadow-[0_5px_14px_rgba(23,25,29,0.16)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-white bg-[#f2f5f3] p-1" role="group" aria-label="Quick ranges">
          {quickRanges.map((range) => {
            const active = range.start === summary.start && range.end === summary.end;
            return (
              <button
                key={range.id}
                type="button"
                onClick={() => showRange(range.start, range.end)}
                disabled={pending}
                aria-pressed={active}
                className={cn(
                  "min-h-[34px] rounded-full px-4 text-xs font-extrabold transition",
                  active ? "bg-[#17191d] text-white shadow-[0_5px_14px_rgba(23,25,29,0.16)]" : "text-[#5f706c] hover:text-[#17191d]",
                )}
              >
                {range.label}
              </button>
            );
          })}
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            showRange(from, to);
          }}
        >
          <label className="grid gap-1 text-[11px] font-extrabold uppercase tracking-wide text-[#6f7f7b]">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="h-10 rounded-xl border border-[#dbe6df] bg-white px-3 text-sm font-semibold text-[#243635]"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-extrabold uppercase tracking-wide text-[#6f7f7b]">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="h-10 rounded-xl border border-[#dbe6df] bg-white px-3 text-sm font-semibold text-[#243635]"
            />
          </label>
          <button
            type="submit"
            disabled={pending || !from || !to || from > to || (from === summary.start && to === summary.end)}
            className="h-10 rounded-full border border-[#dbe6df] bg-white px-4 text-xs font-extrabold text-[#1e4642] shadow-sm hover:bg-[#f2f8f3] disabled:opacity-40"
          >
            Show
          </button>
        </form>
      </div>

      {summary.error ? (
        <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{summary.error}</p>
      ) : null}

      <div className="mb-5 grid grid-cols-3 gap-3 sm:max-w-2xl">
        <div className="rounded-2xl bg-[#eef4ff] px-4 py-3 text-[#3d6ea8]">
          <strong className="block text-2xl font-black leading-none">{summary.workingDays}</strong>
          <span className="text-[11px] font-bold opacity-80">
            working days{summary.countedThrough ? ` to ${shortDate(summary.countedThrough)}` : ""}
          </span>
        </div>
        <div className="rounded-2xl bg-[#dcf5e7] px-4 py-3 text-[#1f7a55]">
          <strong className="block text-2xl font-black leading-none">{hasRecords ? averageAttendance : "—"}</strong>
          <span className="text-[11px] font-bold opacity-80">average days attended</span>
        </div>
        <div className="rounded-2xl bg-[#fff4ee] px-4 py-3 text-[#b4643c]">
          <strong className="block text-2xl font-black leading-none">{hasRecords ? totalLate : "—"}</strong>
          <span className="text-[11px] font-bold opacity-80">late minutes in total</span>
        </div>
      </div>

      {sections.length > 2 ? (
        <div className="mb-4 flex flex-wrap gap-1 rounded-full border border-white bg-[#f2f5f3] p-1 sm:w-fit" role="group" aria-label="Section">
          {sections.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSection(name)}
              aria-pressed={section === name}
              className={cn(
                "min-h-[34px] rounded-full px-4 text-xs font-extrabold transition",
                section === name ? "bg-[#17191d] text-white shadow-[0_5px_14px_rgba(23,25,29,0.16)]" : "text-[#5f706c] hover:text-[#17191d]",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {pending ? (
        <p className="flex items-center gap-2 py-10 text-sm font-semibold text-[#84918e]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : !hasRecords ? (
        <div className="rounded-[24px] border border-[#e8ece9] bg-[#fbfcfb] px-6 py-12 text-center">
          <p className="font-black text-[#1c2d2e]">No council attendance for {title}</p>
          <p className="mt-1 text-sm text-[#7b8a8b]">There are no attendance sheets for these dates yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-[#e8ece9] bg-white shadow-[0_9px_25px_rgba(61,50,73,0.06)]">
          <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,14rem)_8rem] gap-4 border-b border-[#eef2ef] bg-[#fbfcfb] px-5 py-3 text-[11px] font-extrabold uppercase tracking-wide text-[#93a29b] sm:grid">
            <span>#</span>
            <span>Employee</span>
            <span>Days attended</span>
            <span className="text-right">Late minutes</span>
          </div>
          <ol className="divide-y divide-[#f0f3f1]">
            {rows.map((row, index) => {
              const share = summary.workingDays ? Math.min(1, row.daysAttended / summary.workingDays) : 0;
              return (
                <li
                  key={row.employeeId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,14rem)_8rem]"
                >
                  <span className="hidden text-xs font-bold tabular-nums text-[#93a29b] sm:block">{String(index + 1).padStart(2, "0")}</span>
                  <div className="flex min-w-0 items-center gap-3">
                    <AvatarGlow name={row.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#1c2d2e]">{row.name}</p>
                      <p className="truncate text-xs font-medium text-[#7b8a8b]">
                        {row.designation || row.section || "—"}
                        {!row.tracked ? <span className="ml-1.5 rounded-full bg-[#f6f4f8] px-2 py-0.5 text-[10px] font-bold text-[#8a8792]">Not on fingerprint</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-black tabular-nums text-[#1c2d2e]">
                        {row.daysAttended}
                        <span className="text-xs font-bold text-[#93a29b]"> / {summary.workingDays}</span>
                      </span>
                      {row.leaveDays ? (
                        <span className="text-[11px] font-bold text-[#3d6ea8]">{row.leaveDays} on leave</span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef2ef]">
                      <span className="block h-full rounded-full bg-gradient-to-r from-[#8fe0c2] to-[#2f9c80]" style={{ width: `${share * 100}%` }} />
                    </div>
                  </div>
                  <div className="col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto">
                    <span className={cn("text-lg font-black tabular-nums", row.lateMinutes ? "text-[#b4643c]" : "text-[#c3c9c6]")}>
                      {row.lateMinutes}
                    </span>
                    <span className="ml-1 text-xs font-bold text-[#93a29b]">min</span>
                    {row.lateDays ? (
                      <p className="text-[11px] font-semibold text-[#93a29b]">on {row.lateDays} {row.lateDays === 1 ? "day" : "days"}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </main>
  );
}
