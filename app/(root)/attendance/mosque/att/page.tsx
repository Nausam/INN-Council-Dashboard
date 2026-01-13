/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

type HHMM = { h: number | ""; m: number | "" };

type DayTimes = {
  fajr: HHMM;
  dhuhr: HHMM;
  asr: HHMM;
  maghrib: HHMM;
  isha: HHMM;
};

type DayRow = {
  day: number;
  dayName: string;
  weekday: number; // 0=Sun..6=Sat
  shaded?: boolean;
};

const GROUPS = [
  { key: "fajr", label: "ފަތިސް ނަމާދު" },
  { key: "dhuhr", label: "މެންދުރު ނަމާދު" },
  { key: "asr", label: "އަޞުރު ނަމާދު" },
  { key: "maghrib", label: "މަޣްރިބް ނަމާދު" },
  { key: "isha", label: "އިޝާ ނަމާދު" },
] as const;

type GroupKey = (typeof GROUPS)[number]["key"];

const DHIVEHI_WEEKDAYS: Record<number, string> = {
  0: "އާދިއްތަ",
  1: "ހޯމަ",
  2: "އަންގާރަ",
  3: "ބުދަ",
  4: "ބުރާސްފަތި",
  5: "ހުކުރު",
  6: "ހޮނިހިރު",
};

const MONTHS = [
  { value: 0, label: "ޖެނުއަރީ" },
  { value: 1, label: "ފެބްރުއަރީ" },
  { value: 2, label: "މާރިޗް" },
  { value: 3, label: "އޭޕްރިލް" },
  { value: 4, label: "މޭ" },
  { value: 5, label: "ޖޫން" },
  { value: 6, label: "ޖުލައި" },
  { value: 7, label: "އޯގަސްޓް" },
  { value: 8, label: "ސެޕްޓެމްބަރު" },
  { value: 9, label: "އޮކްޓޯބަރު" },
  { value: 10, label: "ނޮވެމްބަރު" },
  { value: 11, label: "ޑިސެމްބަރު" },
] as const;

type ApiPayload = {
  date: string;
  times: {
    fathisTime: string;
    sunrise: string;
    mendhuruTime: string;
    asuruTime: string;
    maqribTime: string;
    ishaTime: string;
  };
};

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function applyMinuteOffset(v: HHMM, deductMinutes: number): HHMM {
  if (v.h === "" || v.m === "") return v;

  const h = Number(v.h);
  const m = Number(v.m);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { h: "", m: "" };

  const total = h * 60 + m;
  let next = total - deductMinutes;

  next = ((next % 1440) + 1440) % 1440;

  return { h: Math.floor(next / 60), m: next % 60 };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoForDay(year: number, month0: number, day: number) {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function parseHHMM(s: string | null | undefined): HHMM {
  if (!s) return { h: "", m: "" };
  const [hh, mm] = s.split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { h: "", m: "" };
  return { h, m };
}

function buildRowsForMonth(year: number, monthIndex0: number): DayRow[] {
  const dim = daysInMonth(year, monthIndex0);
  const rows: DayRow[] = [];
  for (let d = 1; d <= dim; d++) {
    const weekday = new Date(year, monthIndex0, d).getDay();
    rows.push({
      day: d,
      weekday,
      dayName: DHIVEHI_WEEKDAYS[weekday] ?? "",
      shaded: false,
    });
  }
  return rows;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = new Array(items.length) as R[];
  let idx = 0;

  async function run() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i]);
    }
  }

  const runners = Array.from({ length: Math.max(1, limit) }, () => run());
  await Promise.all(runners);
  return results;
}

/** tighter columns (your working values) */
const TIME_COL_W = "42px";
const DAYNAME_W = "50px";
const DAYNUM_W = "40px";

const th =
  "border border-neutral-700/70 bg-neutral-200 text-center align-middle whitespace-nowrap px-[2px] py-1 font-semibold text-black";
const td =
  "border border-neutral-700/70 text-center align-middle whitespace-nowrap px-[2px] py-1";

type RangeKey = "A" | "B" | "BOTH";

/** Range A = 1..10, Range B = 11..end */
function buildRangeOptions(dim: number) {
  const aFrom = 1;
  const aTo = Math.min(10, dim);
  const bFrom = Math.min(11, dim);
  const bTo = dim;

  return {
    A: { from: aFrom, to: aTo, label: `Range A (${aFrom}-${aTo})` },
    B: { from: bFrom, to: bTo, label: `Range B (${bFrom}-${bTo})` },
    BOTH: { from: 1, to: dim, label: `Both (1-${dim})` },
  } as const;
}

export default function Page() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth());

  const [shadedDays, setShadedDays] = useState<Set<number>>(() => new Set());
  const [timesByDay, setTimesByDay] = useState<Record<number, DayTimes>>({});
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [timesError, setTimesError] = useState<string | null>(null);

  const dim = useMemo(() => daysInMonth(year, month), [year, month]);
  const baseRows = useMemo(() => buildRowsForMonth(year, month), [year, month]);

  const [deductMins, setDeductMins] = useState<number>(5);

  const rows = useMemo(() => {
    return baseRows.map((r) => {
      const weekend = r.weekday === 5 || r.weekday === 6;
      return { ...r, shaded: weekend || shadedDays.has(r.day) };
    });
  }, [baseRows, shadedDays]);

  // keep shaded days valid when month changes
  useEffect(() => {
    setShadedDays((prev) => {
      const next = new Set<number>();
      prev.forEach((d) => {
        if (d >= 1 && d <= dim) next.add(d);
      });
      return next;
    });
  }, [dim]);

  // ===== Empty rules: day -> which prayer(s) should be blank =====
  type PrayerSelect = GroupKey | "ALL";
  type EmptyRules = Record<number, Partial<Record<GroupKey, true>>>;

  const [emptyRules, setEmptyRules] = useState<EmptyRules>({});
  const [emptyDay, setEmptyDay] = useState<number>(1);
  const [emptyPrayer, setEmptyPrayer] = useState<PrayerSelect>("ALL");

  function isEmpty(day: number, key: GroupKey) {
    return !!emptyRules[day]?.[key];
  }

  function addEmptyRule(day: number, prayer: PrayerSelect) {
    setEmptyRules((prev) => {
      const next: EmptyRules = { ...prev };
      const dayMap = { ...(next[day] ?? {}) };

      if (prayer === "ALL") {
        for (const g of GROUPS) dayMap[g.key] = true;
      } else {
        dayMap[prayer] = true;
      }

      next[day] = dayMap;
      return next;
    });
  }

  function removeEmptyRule(day: number, prayer: PrayerSelect) {
    setEmptyRules((prev) => {
      const existing = prev[day];
      if (!existing) return prev;

      const next: EmptyRules = { ...prev };
      const dayMap = { ...existing };

      if (prayer === "ALL") {
        delete next[day];
        return next;
      }

      delete dayMap[prayer];
      if (Object.keys(dayMap).length === 0) delete next[day];
      else next[day] = dayMap;

      return next;
    });
  }

  function groupLabel(key: GroupKey) {
    return GROUPS.find((g) => g.key === key)?.label ?? key;
  }

  // keep empty rules valid when month changes
  useEffect(() => {
    setEmptyRules((prev) => {
      const next: EmptyRules = {};
      for (const [k, v] of Object.entries(prev)) {
        const day = Number(k);
        if (day >= 1 && day <= dim) next[day] = v;
      }
      return next;
    });

    setEmptyDay((d) => (d >= 1 && d <= dim ? d : 1));
  }, [dim]);

  // fetch month data
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        setLoadingTimes(true);
        setTimesError(null);
        setTimesByDay({});

        const days = Array.from({ length: dim }, (_, i) => i + 1);

        const results = await mapWithConcurrency(days, 6, async (day) => {
          const iso = isoForDay(year, month, day);
          const res = await fetch(
            `/api/innamaadhoo?date=${encodeURIComponent(iso)}`,
            {
              cache: "no-store",
              signal: controller.signal,
            }
          );

          if (!res.ok) return { day, data: null as ApiPayload | null };

          const json = (await res.json()) as ApiPayload;
          return { day, data: json };
        });

        if (!alive) return;

        const map: Record<number, DayTimes> = {};
        for (const r of results) {
          if (!r.data) continue;

          map[r.day] = {
            fajr: parseHHMM(r.data.times.fathisTime),
            dhuhr: parseHHMM(r.data.times.mendhuruTime),
            asr: parseHHMM(r.data.times.asuruTime),
            maghrib: parseHHMM(r.data.times.maqribTime),
            isha: parseHHMM(r.data.times.ishaTime),
          };
        }

        setTimesByDay(map);
      } catch (e: any) {
        if (!alive) return;
        if (e?.name === "AbortError") return;
        setTimesError(
          e instanceof Error ? e.message : "Failed to load month times"
        );
      } finally {
        if (alive) setLoadingTimes(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [year, month, dim]);

  function toggleShade(day: number) {
    setShadedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function printOnePage() {
    window.print();
  }

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? "";

  type HeadingMode = "ATTENDANCE" | "SHEET2";

  const [headingMode, setHeadingMode] = useState<HeadingMode>("ATTENDANCE");

  const headingText =
    headingMode === "ATTENDANCE"
      ? `މިސްކިތު އިމާމުން ފަސްވަގުތު މިސްކިތަށް ޙާޟިރު ވަމުންދާގޮތް (${monthLabel} ${year})`
      : `ޕޫލް އިމާމުން/މުދިމުން ފަސްވަގުތު މިސްކިތަށް ޙާޟިރު ވަމުންދާގޮތުގެ ޙާޒިރީ (${monthLabel} ${year})`; // <- change this text

  // ✅ two dropdowns, pick A/B/BOTH
  const [viewSelect, setViewSelect] = useState<RangeKey>("BOTH");
  const [printSelect, setPrintSelect] = useState<RangeKey>("BOTH");

  // keep print selection synced to view selection by default
  useEffect(() => {
    setPrintSelect(viewSelect);
  }, [viewSelect, year, month]); // month/year change will keep them aligned

  const ranges = useMemo(() => buildRangeOptions(dim), [dim]);

  const viewRows = useMemo(() => {
    const r = ranges[viewSelect];
    return rows.filter((x) => x.day >= r.from && x.day <= r.to);
  }, [rows, ranges, viewSelect]);

  const printRows = useMemo(() => {
    const r = ranges[printSelect];
    return rows.filter((x) => x.day >= r.from && x.day <= r.to);
  }, [rows, ranges, printSelect]);

  type ImamOptionKey = "Shahidh" | "Zahidh" | "Umair" | "Neem" | "Yazaan";

  const IMAM_OPTIONS: Record<ImamOptionKey, string> = {
    Shahidh: " އިމާމް: މުހައްމަދު ޝާހިދު / ނީލޯފަރު",
    Zahidh: " އިމާމް: އަޙްމަދު ޒާހިދު / ބަށިމާގެ",
    Umair:
      " އިމާމް: އުމައިރު ޒާޚިރު ހުސައިން ވަލްވަތްކަރު / އިންޑިއާ (T4650904)",
    Neem: "މުދިމު: އިސްމާޢީލް ނީމް / ނޫރާނީގެ",
    Yazaan: "މުދިމު: ޙުސައިން ޔަޒާން އަޙްމަދު / އޯޝަންވިލާ",
  };

  const [imamKey, setImamKey] = useState<ImamOptionKey>("Shahidh");
  const imamText = IMAM_OPTIONS[imamKey];

  return (
    <div dir="rtl" className="min-h-dvh bg-white p-6 font-dh1">
      {/* ✅ print rules + only print selected range */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 4mm; }

          .no-print { display: none !important; }

          /* hide all view rows on print */
          #view-area { display: none !important; }

          /* print ONLY the selected range */
          #print-area { display: block !important; }

          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }

        /* normal screen: show view, hide print clone */
        #print-area { display: none; }
      `}</style>

      <div className="mx-auto w-full max-w-[1400px] overflow-auto">
        {/* Controls */}
        <div className="no-print mb-4">
          {/* toolbar */}
          <div className="rounded-2xl border border-neutral-200 bg-white/80 p-3 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Left: primary action */}
              <div className="flex items-center justify-between gap-2 md:justify-start">
                <button
                  type="button"
                  onClick={printOnePage}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 active:translate-y-[1px]"
                >
                  ޕްރިންޓް
                </button>

                {/* Optional: small hint / status */}
                <div className="text-xs text-neutral-500 md:hidden">
                  {monthLabel} {year}
                </div>
              </div>

              {/* Right: controls grid */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                {/* shared styles */}
                {/* (keep classes inline to avoid extra code) */}

                {/* Month */}
                <div className="col-span-1">
                  <div className="mb-1 text-[11px] font-semibold text-neutral-600">
                    މަސް
                  </div>
                  <select
                    className="h-10 w-full rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div className="col-span-1">
                  <div className="mb-1 text-[11px] font-semibold text-neutral-600">
                    އަހަރު
                  </div>
                  <input
                    className="h-10 w-full rounded-xl bg-white px-3 text-center text-sm shadow-sm ring-1 ring-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    type="number"
                    value={year}
                    onChange={(e) =>
                      setYear(Number(e.target.value || now.getFullYear()))
                    }
                  />
                </div>

                {/* Deduct minutes */}
                <div className="col-span-1">
                  <div className="mb-1 text-[11px] font-semibold text-neutral-600">
                    ކަނޑާ މިނަޓް
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    step={1}
                    value={deductMins}
                    onChange={(e) =>
                      setDeductMins(clampInt(Number(e.target.value), 0, 180))
                    }
                    className="h-10 w-full rounded-xl bg-white px-3 text-center text-sm shadow-sm ring-1 ring-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>

                {/* View range */}
                <div className="col-span-1">
                  <div className="mb-1 text-[11px] font-semibold text-neutral-600">
                    View
                  </div>
                  <select
                    className="h-10 w-full rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    value={viewSelect}
                    onChange={(e) => setViewSelect(e.target.value as RangeKey)}
                  >
                    <option value="A">{ranges.A.label}</option>
                    <option value="B">{ranges.B.label}</option>
                    <option value="BOTH">{ranges.BOTH.label}</option>
                  </select>
                </div>

                {/* Heading (no-print already on wrapper) */}
                <div className="col-span-1">
                  <div className="mb-1 text-[11px] font-semibold text-neutral-600">
                    ހެޑިންގް
                  </div>
                  <select
                    value={headingMode}
                    onChange={(e) =>
                      setHeadingMode(e.target.value as HeadingMode)
                    }
                    className="h-10 w-full rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="ATTENDANCE">އިމާމު</option>
                    <option value="SHEET2">ޕޫލް</option>
                  </select>
                </div>

                {/* Imam */}
                <div className="col-span-1">
                  <div className="mb-1 text-[11px] font-semibold text-neutral-600">
                    އިމާމް / މުދިމު
                  </div>
                  <select
                    value={imamKey}
                    onChange={(e) =>
                      setImamKey(e.target.value as ImamOptionKey)
                    }
                    className="h-10 w-full rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="Shahidh">ސާހިދު</option>
                    <option value="Zahidh">ޒާހިދު</option>
                    <option value="Neem">ނީމް</option>
                    <option value="Yazaan">ޔަޒާން</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Empty rules row (separate, cleaner) */}
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-12">
              <div className="md:col-span-12 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <div className="mb-1 text-[11px] font-semibold text-neutral-600">
                        Empty
                      </div>
                      <select
                        className="h-10 rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={emptyDay}
                        onChange={(e) => setEmptyDay(Number(e.target.value))}
                      >
                        {Array.from({ length: dim }, (_, i) => i + 1).map(
                          (d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] font-semibold text-neutral-600">
                        Prayer
                      </div>
                      <select
                        className="h-10 rounded-xl bg-white px-3 text-sm shadow-sm ring-1 ring-neutral-200 transition focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        value={emptyPrayer}
                        onChange={(e) =>
                          setEmptyPrayer(e.target.value as PrayerSelect)
                        }
                      >
                        <option value="ALL">All prayers</option>
                        {GROUPS.map((g) => (
                          <option key={g.key} value={g.key}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => addEmptyRule(emptyDay, emptyPrayer)}
                      className="h-10 rounded-xl bg-white px-4 text-sm font-semibold shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-100 active:translate-y-[1px]"
                    >
                      Apply
                    </button>
                  </div>

                  {/* quick clear (optional) */}
                  <button
                    type="button"
                    onClick={() => setEmptyRules({})}
                    className="h-10 rounded-xl px-4 text-sm font-semibold text-neutral-600 ring-1 ring-neutral-200 transition hover:bg-white"
                  >
                    Clear empties
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Optional chips list for applied empty rules */}
        {Object.keys(emptyRules).length > 0 ? (
          <div className="no-print mb-3 flex flex-wrap justify-end gap-2">
            {Object.entries(emptyRules)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([dayStr, rules]) => {
                const day = Number(dayStr);
                const keys = GROUPS.filter((g) => rules[g.key]).map(
                  (g) => g.key
                );

                const label =
                  keys.length === GROUPS.length
                    ? `Day ${day}: All`
                    : `Day ${day}: ${keys.map(groupLabel).join("، ")}`;

                return (
                  <button
                    key={dayStr}
                    type="button"
                    onClick={() => removeEmptyRule(day, "ALL")}
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-50"
                    title="Remove"
                  >
                    {label} ✕
                  </button>
                );
              })}
          </div>
        ) : null}

        {/* ===== SCREEN VIEW TABLE (selected range only) ===== */}
        <div className="bg-white" id="view-area">
          <Table
            className="w-full table-fixed border-collapse text-center text-[18px] leading-none text-black"
            style={{ direction: "rtl" }}
          >
            <colgroup>
              <col style={{ width: DAYNUM_W }} />
              <col style={{ width: DAYNAME_W }} />
              {Array.from({ length: 15 }).map((_, i) => (
                <col key={i} style={{ width: TIME_COL_W }} />
              ))}
            </colgroup>

            <TableHeader>
              <TableRow>
                <TableHead colSpan={17} className={`${th} py-3 text-[26px]`}>
                  {headingText}
                </TableHead>
              </TableRow>

              <TableRow>
                <TableHead colSpan={17} className={`${th} py-3 text-[26px]`}>
                  {imamText}
                </TableHead>
              </TableRow>

              <TableRow>
                <TableHead rowSpan={3} className={`${th} text-[20px]`}>
                  ދުވަސް
                </TableHead>
                <TableHead rowSpan={3} className={`${th} text-[20px]`}>
                  ތާރީޚް
                </TableHead>

                {GROUPS.map((g) => (
                  <TableHead
                    key={g.key}
                    colSpan={3}
                    className={`${th} py-2 text-[20px]`}
                  >
                    {g.label}
                  </TableHead>
                ))}
              </TableRow>

              <TableRow>
                {GROUPS.map((g) => (
                  <TableHead
                    key={g.key}
                    colSpan={3}
                    className={`${th} py-2 text-[18px]`}
                  >
                    މަސައްކަތް ފެށި
                  </TableHead>
                ))}
              </TableRow>

              <TableRow>
                {Array.from({ length: 5 }).map((_, gi) => (
                  <React.Fragment key={gi}>
                    <TableHead className={`${th} text-[16px]`}>މ</TableHead>
                    <TableHead className={`${th} text-[16px]`}>ގ</TableHead>
                    <TableHead className={`${th} text-[16px]`}>ސޮއި</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {viewRows.map((r) => {
                const t = timesByDay[r.day];

                const get = (k: GroupKey): HHMM =>
                  k === "fajr"
                    ? t?.fajr ?? { h: "", m: "" }
                    : k === "dhuhr"
                    ? t?.dhuhr ?? { h: "", m: "" }
                    : k === "asr"
                    ? t?.asr ?? { h: "", m: "" }
                    : k === "maghrib"
                    ? t?.maghrib ?? { h: "", m: "" }
                    : t?.isha ?? { h: "", m: "" };

                return (
                  <TableRow
                    key={r.day}
                    onClick={() => toggleShade(r.day)}
                    className={[
                      r.shaded ? "bg-neutral-200" : "",
                      "cursor-pointer hover:bg-neutral-100",
                    ].join(" ")}
                  >
                    <TableCell className={`${td} text-md font-semibold`}>
                      {r.day}
                    </TableCell>
                    <TableCell className={`${td} text-md font-semibold`}>
                      {r.dayName}
                    </TableCell>

                    {GROUPS.flatMap((g) => {
                      if (isEmpty(r.day, g.key)) {
                        return [
                          <TableCell
                            key={`${g.key}-m-${r.day}`}
                            className={`${td} text-[18px] font-medium`}
                          >
                            {""}
                          </TableCell>,
                          <TableCell
                            key={`${g.key}-h-${r.day}`}
                            className={`${td} text-[18px] font-medium`}
                          >
                            {""}
                          </TableCell>,
                          <TableCell
                            key={`${g.key}-sig-${r.day}`}
                            className={`${td} text-[16px]`}
                          />,
                        ];
                      }

                      const v = applyMinuteOffset(get(g.key), deductMins);
                      return [
                        <TableCell
                          key={`${g.key}-m-${r.day}`}
                          className={`${td} text-[18px] font-medium`}
                        >
                          {v.m}
                        </TableCell>,
                        <TableCell
                          key={`${g.key}-h-${r.day}`}
                          className={`${td} text-[18px] font-medium`}
                        >
                          {v.h}
                        </TableCell>,
                        <TableCell
                          key={`${g.key}-sig-${r.day}`}
                          className={`${td} text-[16px]`}
                        />,
                      ];
                    })}
                  </TableRow>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="border border-neutral-700/70 bg-neutral-200 py-4 text-center text-[22px] font-bold"
                >
                  ޗެކްކުރި ސޮއި
                </TableCell>
                <TableCell
                  colSpan={14}
                  className="border border-neutral-700/70 bg-white py-5"
                />
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* ===== PRINT TABLE (selected print range only) ===== */}
        <div className="bg-white" id="print-area">
          <Table
            className="w-full table-fixed border-collapse text-center text-[18px] leading-none text-black"
            style={{ direction: "rtl" }}
          >
            <colgroup>
              <col style={{ width: DAYNUM_W }} />
              <col style={{ width: DAYNAME_W }} />
              {Array.from({ length: 15 }).map((_, i) => (
                <col key={i} style={{ width: TIME_COL_W }} />
              ))}
            </colgroup>

            <TableHeader>
              <TableRow>
                <TableHead colSpan={17} className={`${th} py-3 text-[26px]`}>
                  {headingText}
                </TableHead>
              </TableRow>

              <TableRow>
                <TableHead colSpan={17} className={`${th} py-3 text-[26px]`}>
                  {imamText}
                </TableHead>
              </TableRow>

              <TableRow>
                <TableHead rowSpan={3} className={`${th} text-[20px]`}>
                  ދުވަސް
                </TableHead>
                <TableHead rowSpan={3} className={`${th} text-[20px]`}>
                  ތާރީޚް
                </TableHead>

                {GROUPS.map((g) => (
                  <TableHead
                    key={g.key}
                    colSpan={3}
                    className={`${th} py-2 text-[20px]`}
                  >
                    {g.label}
                  </TableHead>
                ))}
              </TableRow>

              <TableRow>
                {GROUPS.map((g) => (
                  <TableHead
                    key={g.key}
                    colSpan={3}
                    className={`${th} py-2 text-[18px]`}
                  >
                    މަސައްކަތް ފެށި
                  </TableHead>
                ))}
              </TableRow>

              <TableRow>
                {Array.from({ length: 5 }).map((_, gi) => (
                  <React.Fragment key={gi}>
                    <TableHead className={`${th} text-[16px]`}>މ</TableHead>
                    <TableHead className={`${th} text-[16px]`}>ގ</TableHead>
                    <TableHead className={`${th} text-[16px]`}>ސޮއި</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {printRows.map((r) => {
                const t = timesByDay[r.day];

                const get = (k: GroupKey): HHMM =>
                  k === "fajr"
                    ? t?.fajr ?? { h: "", m: "" }
                    : k === "dhuhr"
                    ? t?.dhuhr ?? { h: "", m: "" }
                    : k === "asr"
                    ? t?.asr ?? { h: "", m: "" }
                    : k === "maghrib"
                    ? t?.maghrib ?? { h: "", m: "" }
                    : t?.isha ?? { h: "", m: "" };

                return (
                  <TableRow
                    key={r.day}
                    className={[r.shaded ? "bg-neutral-200" : ""].join(" ")}
                  >
                    <TableCell className={`${td} text-md font-semibold`}>
                      {r.day}
                    </TableCell>
                    <TableCell className={`${td} text-md font-semibold`}>
                      {r.dayName}
                    </TableCell>

                    {GROUPS.flatMap((g) => {
                      if (isEmpty(r.day, g.key)) {
                        return [
                          <TableCell
                            key={`${g.key}-m-${r.day}`}
                            className={`${td} text-[18px] font-medium`}
                          >
                            {""}
                          </TableCell>,
                          <TableCell
                            key={`${g.key}-h-${r.day}`}
                            className={`${td} text-[18px] font-medium`}
                          >
                            {""}
                          </TableCell>,
                          <TableCell
                            key={`${g.key}-sig-${r.day}`}
                            className={`${td} text-[16px]`}
                          />,
                        ];
                      }

                      const v = applyMinuteOffset(get(g.key), deductMins);
                      return [
                        <TableCell
                          key={`${g.key}-m-${r.day}`}
                          className={`${td} text-[18px] font-medium`}
                        >
                          {v.m}
                        </TableCell>,
                        <TableCell
                          key={`${g.key}-h-${r.day}`}
                          className={`${td} text-[18px] font-medium`}
                        >
                          {v.h}
                        </TableCell>,
                        <TableCell
                          key={`${g.key}-sig-${r.day}`}
                          className={`${td} text-[16px]`}
                        />,
                      ];
                    })}
                  </TableRow>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="border border-neutral-700/70 bg-neutral-200 py-4 text-center text-[22px] font-bold"
                >
                  ޗެކްކުރި ސޮއި
                </TableCell>
                <TableCell
                  colSpan={14}
                  className="border border-neutral-700/70 bg-white py-5"
                />
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* status */}
        {timesError ? (
          <div className="no-print mt-2 text-right text-sm text-red-600">
            {timesError}
          </div>
        ) : loadingTimes ? (
          <div className="no-print mt-2 text-right text-sm text-neutral-600">
            Loading...
          </div>
        ) : null}
      </div>
    </div>
  );
}
