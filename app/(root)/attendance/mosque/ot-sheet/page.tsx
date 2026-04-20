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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type HHMM = { h: number | ""; m: number | "" };

type DayTimes = {
  fajr: HHMM;
  dhuhr: HHMM;
  asr: HHMM;
  maghrib: HHMM;
  isha: HHMM;
};

type GroupKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "fajr", label: "ފަތިސް ނަމާދު" },
  { key: "dhuhr", label: "މެންދުރު ނަމާދު" },
  { key: "asr", label: "އަޞުރު ނަމާދު" },
  { key: "maghrib", label: "މަޣްރިބު ނަމާދު" },
  { key: "isha", label: "ޢިޝާ ނަމާދު" },
];

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
  { value: 0, label: "ޖެނުއަރީ", dh: "ޖެނުއަރީ" },
  { value: 1, label: "ފެބްރުއަރީ", dh: "ފެބުރުވަރީ" },
  { value: 2, label: "މާރިޗް", dh: "މާރިޗު" },
  { value: 3, label: "އޭޕްރިލް", dh: "އޭޕްރިލް" },
  { value: 4, label: "މޭ", dh: "މޭ" },
  { value: 5, label: "ޖޫން", dh: "ޖޫން" },
  { value: 6, label: "ޖުލައި", dh: "ޖުލައި" },
  { value: 7, label: "އޯގަސްޓް", dh: "އޯގަސްޓު" },
  { value: 8, label: "ސެޕްޓެމްބަރު", dh: "ސެޕްޓެންބަރު" },
  { value: 9, label: "އޮކްޓޯބަރު", dh: "އޮކްޓޯބަރު" },
  { value: 10, label: "ނޮވެމްބަރު", dh: "ނޮވެންބަރު" },
  { value: 11, label: "ޑިސެމްބަރު", dh: "ޑިސެންބަރު" },
] as const;

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatHHMM(v: HHMM): string {
  if (v.h === "" || v.m === "") return "";
  return `${v.h}:${pad2(Number(v.m))}`;
}

function applyMinuteOffset(v: HHMM, deductMinutes: number): HHMM {
  if (v.h === "" || v.m === "") return v;
  const total = Number(v.h) * 60 + Number(v.m);
  let next = total - deductMinutes;
  next = ((next % 1440) + 1440) % 1440;
  return { h: Math.floor(next / 60), m: next % 60 };
}

function isoForDay(year: number, month0: number, day: number) {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

function parseHHMM(s: string | null | undefined): HHMM {
  if (!s) return { h: "", m: "" };
  const [hh, mm] = s.split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { h: "", m: "" };
  return { h, m };
}

function englishDateLabel(year: number, month0: number, day: number) {
  return `${ENGLISH_MONTHS[month0]} ${day}, ${year}`;
}

function dhivehiDateLabel(year: number, month0: number, day: number) {
  const dh = MONTHS[month0]?.dh ?? "";
  return `${day} ${dh} ${year}`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
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

type DateEntry = {
  iso: string; // YYYY-MM-DD
  year: number;
  month0: number;
  day: number;
  weekday: number;
};

/**
 * Build the OT cycle dates: 11th of the previous month through 10th of the
 * chosen "end" month (inclusive on both ends).
 */
function buildRangeDates(endYear: number, endMonth0: number): DateEntry[] {
  const start = new Date(endYear, endMonth0 - 1, 11);
  const end = new Date(endYear, endMonth0, 10);
  const out: DateEntry[] = [];
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    const y = d.getFullYear();
    const m0 = d.getMonth();
    const day = d.getDate();
    out.push({
      iso: isoForDay(y, m0, day),
      year: y,
      month0: m0,
      day,
      weekday: d.getDay(),
    });
  }
  return out;
}

const th =
  "border border-neutral-700/70 bg-neutral-200 text-center align-middle whitespace-nowrap px-1 py-1 font-semibold text-black";
const td =
  "border border-neutral-700/70 text-center align-middle whitespace-nowrap px-1 py-1";

type ImamOptionKey = "Shahidh" | "Zahidh";

type ImamInfo = {
  idNumber: string;
  position: string;
  name: string;
  signatureSrc?: string;
  signatureHeightClass?: string;
};

const IMAM_INFO: Record<ImamOptionKey, ImamInfo> = {
  Shahidh: {
    idNumber: "A105751",
    position: "އިމާމް",
    name: "މުޙައްމަދު ޝާހިދު",
    signatureSrc: "/assets/images/shahidh.png",
    signatureHeightClass: "h-8",
  },
  Zahidh: {
    idNumber: "A104244",
    position: "އިމާމް",
    name: "އަޙްމަދު ޒާހިދު",
    signatureSrc: "/assets/images/Zahidh.png",
    signatureHeightClass: "h-8",
  },
};

const IMAM_LABEL: Record<ImamOptionKey, string> = {
  Shahidh: "ޝާހިދު",
  Zahidh: "ޒާހިދު",
};

export default function Page() {
  const now = new Date();

  // "endMonth"/"endYear" represent the month whose 10th is the end of the OT range.
  const [endYear, setEndYear] = useState<number>(now.getFullYear());
  const [endMonth, setEndMonth] = useState<number>(now.getMonth());
  const [imamKey, setImamKey] = useState<ImamOptionKey>("Shahidh");

  const [otMinutes, setOtMinutes] = useState<number>(60);

  const rangeDates = useMemo(
    () => buildRangeDates(endYear, endMonth),
    [endYear, endMonth],
  );

  const firstDate = rangeDates[0];
  const lastDate = rangeDates[rangeDates.length - 1];

  // Previous month / end month labels for the subtitle
  const prevMonth0 = firstDate.month0;
  const prevYear = firstDate.year;

  // ===== Holidays (keyed by ISO date) =====
  const [holidayDates, setHolidayDates] = useState<Set<string>>(
    () => new Set(),
  );

  // Auto-populate Fri/Sat every time the range changes
  useEffect(() => {
    const next = new Set<string>();
    for (const d of rangeDates) {
      if (d.weekday === 5 || d.weekday === 6) next.add(d.iso);
    }
    setHolidayDates(next);
  }, [rangeDates]);

  function toggleHoliday(iso: string) {
    setHolidayDates((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  // ===== Empty rules: iso date -> which prayers to exclude =====
  type PrayerSelect = GroupKey | "ALL";
  type EmptyRules = Record<string, Partial<Record<GroupKey, true>>>;

  const [emptyRules, setEmptyRules] = useState<EmptyRules>({});
  const [emptyIso, setEmptyIso] = useState<string>("");
  const [emptyPrayer, setEmptyPrayer] = useState<PrayerSelect>("ALL");

  // keep emptyIso valid, and drop stale empty-rules outside the range
  useEffect(() => {
    const validIsos = new Set(rangeDates.map((d) => d.iso));
    setEmptyRules((prev) => {
      const next: EmptyRules = {};
      for (const [iso, v] of Object.entries(prev)) {
        if (validIsos.has(iso)) next[iso] = v;
      }
      return next;
    });
    setEmptyIso((prev) => (validIsos.has(prev) ? prev : rangeDates[0]?.iso ?? ""));
  }, [rangeDates]);

  function isEmpty(iso: string, key: GroupKey) {
    return !!emptyRules[iso]?.[key];
  }

  function addEmptyRule(iso: string, prayer: PrayerSelect) {
    if (!iso) return;
    setEmptyRules((prev) => {
      const next: EmptyRules = { ...prev };
      const dayMap = { ...(next[iso] ?? {}) };
      if (prayer === "ALL") {
        for (const g of GROUPS) dayMap[g.key] = true;
      } else {
        dayMap[prayer] = true;
      }
      next[iso] = dayMap;
      return next;
    });
  }

  function removeEmptyRule(iso: string, prayer: PrayerSelect) {
    setEmptyRules((prev) => {
      const existing = prev[iso];
      if (!existing) return prev;
      const next: EmptyRules = { ...prev };
      const dayMap = { ...existing };
      if (prayer === "ALL") {
        delete next[iso];
        return next;
      }
      delete dayMap[prayer];
      if (Object.keys(dayMap).length === 0) delete next[iso];
      else next[iso] = dayMap;
      return next;
    });
  }

  function groupLabel(key: GroupKey) {
    return GROUPS.find((g) => g.key === key)?.label ?? key;
  }

  // ===== Fetch prayer times for every date in range =====
  const [timesByDate, setTimesByDate] = useState<Record<string, DayTimes>>({});
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [timesError, setTimesError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        setLoadingTimes(true);
        setTimesError(null);
        setTimesByDate({});

        const results = await mapWithConcurrency(rangeDates, 6, async (d) => {
          const res = await fetch(
            `/api/innamaadhoo?date=${encodeURIComponent(d.iso)}`,
            { cache: "no-store", signal: controller.signal },
          );
          if (!res.ok) return { iso: d.iso, data: null as ApiPayload | null };
          const json = (await res.json()) as ApiPayload;
          return { iso: d.iso, data: json };
        });

        if (!alive) return;

        const map: Record<string, DayTimes> = {};
        for (const r of results) {
          if (!r.data) continue;
          map[r.iso] = {
            fajr: parseHHMM(r.data.times.fathisTime),
            dhuhr: parseHHMM(r.data.times.mendhuruTime),
            asr: parseHHMM(r.data.times.asuruTime),
            maghrib: parseHHMM(r.data.times.maqribTime),
            isha: parseHHMM(r.data.times.ishaTime),
          };
        }
        setTimesByDate(map);
      } catch (e: any) {
        if (!alive) return;
        if (e?.name === "AbortError") return;
        setTimesError(
          e instanceof Error ? e.message : "Failed to load prayer times",
        );
      } finally {
        if (alive) setLoadingTimes(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [rangeDates]);

  // ===== Build OT rows =====
  type OtRow = {
    runningNo: number;
    iso: string;
    year: number;
    month0: number;
    day: number;
    weekday: number;
    prayer: GroupKey;
    prayerLabel: string;
    isFirstOfDay: boolean;
    daySpan: number;
    startTime: HHMM;
    endTime: HHMM;
    totalH: number;
    totalM: number;
  };

  const sortedHolidayDates: DateEntry[] = useMemo(
    () => rangeDates.filter((d) => holidayDates.has(d.iso)),
    [rangeDates, holidayDates],
  );

  const otRows: OtRow[] = useMemo(() => {
    const rows: OtRow[] = [];
    let counter = 0;
    for (const d of sortedHolidayDates) {
      const t = timesByDate[d.iso];
      const isFriday = d.weekday === 5;
      const includedPrayers = GROUPS.filter((g) => {
        // Friday never has Dhuhr (Jumu'ah prayer replaces it).
        if (isFriday && g.key === "dhuhr") return false;
        if (isEmpty(d.iso, g.key)) return false;
        return true;
      });
      includedPrayers.forEach((g, idx) => {
        counter += 1;
        const endTime: HHMM = t ? t[g.key] : { h: "", m: "" };
        const startTime = applyMinuteOffset(endTime, otMinutes);
        rows.push({
          runningNo: counter,
          iso: d.iso,
          year: d.year,
          month0: d.month0,
          day: d.day,
          weekday: d.weekday,
          prayer: g.key,
          prayerLabel: g.label,
          isFirstOfDay: idx === 0,
          daySpan: includedPrayers.length,
          startTime,
          endTime,
          totalH: Math.floor(otMinutes / 60),
          totalM: otMinutes % 60,
        });
      });
    }
    return rows;
  }, [sortedHolidayDates, timesByDate, otMinutes, emptyRules]);

  // ===== Range filtering for View / Print =====
  // Range A = 11th of prev month → end of prev month
  // Range B = 1st of end month → 10th of end month
  // BOTH = everything
  type RangeKey = "A" | "B" | "BOTH";

  const ranges = useMemo(() => {
    const prevLabel = `11 ${ENGLISH_MONTHS[prevMonth0].slice(0, 3)} - ${lastDate ? "" : ""}`;
    void prevLabel; // reserved for future
    const aFromIso = firstDate.iso;
    const aToIso = isoForDay(
      prevYear,
      prevMonth0,
      new Date(endYear, prevMonth0 + 1, 0).getDate(),
    );
    const bFromIso = isoForDay(endYear, endMonth, 1);
    const bToIso = lastDate.iso;

    return {
      A: {
        from: aFromIso,
        to: aToIso,
        label: `Range A (${firstDate.day} ${ENGLISH_MONTHS[prevMonth0].slice(0, 3)} - ${new Date(endYear, prevMonth0 + 1, 0).getDate()} ${ENGLISH_MONTHS[prevMonth0].slice(0, 3)})`,
      },
      B: {
        from: bFromIso,
        to: bToIso,
        label: `Range B (1 ${ENGLISH_MONTHS[endMonth].slice(0, 3)} - ${lastDate.day} ${ENGLISH_MONTHS[endMonth].slice(0, 3)})`,
      },
      BOTH: {
        from: firstDate.iso,
        to: lastDate.iso,
        label: `Both (${firstDate.day} ${ENGLISH_MONTHS[prevMonth0].slice(0, 3)} - ${lastDate.day} ${ENGLISH_MONTHS[endMonth].slice(0, 3)})`,
      },
    } as const;
  }, [firstDate, lastDate, prevMonth0, prevYear, endMonth, endYear]);

  const [viewSelect, setViewSelect] = useState<RangeKey>("BOTH");
  const [printSelect, setPrintSelect] = useState<RangeKey>("BOTH");

  // keep print selection synced with view by default
  useEffect(() => {
    setPrintSelect(viewSelect);
  }, [viewSelect, endYear, endMonth]);

  function rowsInRange(rng: { from: string; to: string }): OtRow[] {
    return otRows.filter((r) => r.iso >= rng.from && r.iso <= rng.to);
  }

  const viewRows = useMemo(
    () => rowsInRange(ranges[viewSelect]),
    [otRows, ranges, viewSelect],
  );
  const printRows = useMemo(
    () => rowsInRange(ranges[printSelect]),
    [otRows, ranges, printSelect],
  );

  function printOnePage() {
    window.print();
  }

  // Title subtitle: "11 Feb 2026 އިން 10 Mar 2026 އަށް"
  const titleSubtitle = useMemo(() => {
    const left = dhivehiDateLabel(prevYear, prevMonth0, 11);
    const right = dhivehiDateLabel(endYear, endMonth, 10);
    return `ބަންދު ދުވަސްތަކުގެ އިތުރުގަޑީ ${left} އިން ${right} އަށް`;
  }, [prevYear, prevMonth0, endYear, endMonth]);

  const imam = IMAM_INFO[imamKey];

  // editable employee info (pre-filled from imam)
  const [empId, setEmpId] = useState<string>(imam.idNumber);
  const [empPosition, setEmpPosition] = useState<string>(imam.position);
  const [empName, setEmpName] = useState<string>(imam.name);

  useEffect(() => {
    setEmpId(IMAM_INFO[imamKey].idNumber);
    setEmpPosition(IMAM_INFO[imamKey].position);
    setEmpName(IMAM_INFO[imamKey].name);
  }, [imamKey]);

  const sigSrc = imam.signatureSrc;
  const sigCls = imam.signatureHeightClass ?? "h-8";

  // ===== Renderers =====

  function renderTable(rows: OtRow[]) {
    return (
      <Table
        className="w-full table-fixed border-collapse text-center text-[18px] leading-none text-black"
        style={{ direction: "rtl" }}
      >
        <colgroup>
          <col style={{ width: "40px" }} />
          <col style={{ width: "150px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "70px" }} />
          <col style={{ width: "70px" }} />
          <col style={{ width: "70px" }} />
          <col style={{ width: "70px" }} />
          <col style={{ width: "55px" }} />
          <col style={{ width: "60px" }} />
        </colgroup>

        <TableHeader>
          <TableRow>
            <TableHead colSpan={9} className={`${th} py-3 text-[24px]`}>
              ބަންދު ދުވަސްތަކުގެ އިމާމުންގެ އިތުރުގަޑި ޝީޓް
            </TableHead>
          </TableRow>

          <TableRow>
            <TableHead colSpan={9} className={`${th} py-2 text-[18px]`}>
              {titleSubtitle}
            </TableHead>
          </TableRow>

          <TableRow>
            <TableHead colSpan={9} className={`${th} px-4 py-2 text-[16px]`}>
              <div className="flex w-full items-center justify-between gap-4">
                <span>{`މުވައްޒަފުގެ ނަން: ${empName || ""}`}</span>
                <span>{`މަޤާމް: ${empPosition || ""}`}</span>
                <span>{`އައިޑީ ނަންބަރު: ${empId || ""}`}</span>
              </div>
            </TableHead>
          </TableRow>

          <TableRow>
            <TableHead rowSpan={2} className={`${th} text-[16px]`}>#</TableHead>
            <TableHead rowSpan={2} className={`${th} text-[16px]`}>ތާރީޚް</TableHead>
            <TableHead rowSpan={2} className={`${th} text-[16px]`}>ތަފްސީލް</TableHead>
            <TableHead colSpan={2} className={`${th} text-[16px]`}>މަސައްކަތް ފެށީ</TableHead>
            <TableHead colSpan={2} className={`${th} text-[16px]`}>މަސައްކަތް ނިމުން</TableHead>
            <TableHead colSpan={2} className={`${th} text-[16px]`}>ޖުމްލަ ގަޑި</TableHead>
          </TableRow>

          <TableRow>
            <TableHead className={`${th} text-[14px]`}>ގަޑި</TableHead>
            <TableHead className={`${th} text-[14px]`}>ސޮއި</TableHead>
            <TableHead className={`${th} text-[14px]`}>ގަޑި</TableHead>
            <TableHead className={`${th} text-[14px]`}>ސޮއި</TableHead>
            <TableHead className={`${th} text-[14px]`}>މިނިޓް</TableHead>
            <TableHead className={`${th} text-[14px]`}>ގަޑި</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className={`${td} py-6 text-neutral-500`}>
                ބަންދު ދުވަހެއް ނެތް / އެއްވެސް ނަމާދެއް ހިމެނިފައެއް ނެތް
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={`${r.iso}-${r.prayer}`}>
                <TableCell className={`${td} text-[16px] font-semibold`}>
                  {r.runningNo}
                </TableCell>

                {r.isFirstOfDay ? (
                  <TableCell
                    rowSpan={r.daySpan}
                    className={`${td} text-[15px] font-semibold`}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <span>{englishDateLabel(r.year, r.month0, r.day)}</span>
                      <span className="text-[13px] text-neutral-600">
                        {DHIVEHI_WEEKDAYS[r.weekday]}
                      </span>
                    </div>
                  </TableCell>
                ) : null}

                <TableCell className={`${td} text-[16px]`}>
                  {r.prayerLabel}
                </TableCell>

                <TableCell className={`${td} text-[16px] font-medium`}>
                  {formatHHMM(r.startTime)}
                </TableCell>
                <TableCell className={`${td} relative p-0`}>
                  {sigSrc ? (
                    <img
                      src={sigSrc}
                      alt="signature"
                      className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${sigCls} w-auto max-w-none object-contain`}
                    />
                  ) : null}
                </TableCell>

                <TableCell className={`${td} text-[16px] font-medium`}>
                  {formatHHMM(r.endTime)}
                </TableCell>
                <TableCell className={`${td} relative p-0`}>
                  {sigSrc ? (
                    <img
                      src={sigSrc}
                      alt="signature"
                      className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${sigCls} w-auto max-w-none object-contain`}
                    />
                  ) : null}
                </TableCell>

                <TableCell className={`${td} text-[16px] font-semibold`}>
                  {r.totalM}
                </TableCell>
                <TableCell className={`${td} text-[16px] font-semibold`}>
                  {r.totalH}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell
              colSpan={2}
              className="border border-neutral-700/70 bg-neutral-200 py-4 text-center text-[20px] font-bold"
            >
              ޗެކްކުރި ސޮއި
            </TableCell>
            <TableCell
              colSpan={7}
              className="border border-neutral-700/70 bg-white py-5"
            />
          </TableRow>
        </TableFooter>
      </Table>
    );
  }

  const endMonthLabel = MONTHS.find((m) => m.value === endMonth)?.label ?? "";

  // Group holiday-picker chips by calendar month
  const rangeByMonth = useMemo(() => {
    const groups: { year: number; month0: number; items: DateEntry[] }[] = [];
    for (const d of rangeDates) {
      const head = groups[groups.length - 1];
      if (!head || head.year !== d.year || head.month0 !== d.month0) {
        groups.push({ year: d.year, month0: d.month0, items: [d] });
      } else {
        head.items.push(d);
      }
    }
    return groups;
  }, [rangeDates]);

  return (
    <div dir="rtl" className="min-h-dvh bg-white p-6 font-dh1">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 6mm; }
          .no-print { display: none !important; }
          #view-area { display: none !important; }

          /* Override the single-page pin from globals.css so the OT table
             can flow across multiple pages. */
          #print-area {
            display: block !important;
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          thead { display: table-header-group; }
          /* keep the footer (supervisor signature) on the last page only */
          tfoot { display: table-row-group; }

          /* Avoid splitting a grouped day across pages when possible. */
          tr { page-break-inside: avoid; break-inside: avoid; }

          img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        #print-area { display: none; }
      `}</style>

      <div className="mx-auto w-full max-w-[1400px] overflow-auto">
        {/* ===== Controls ===== */}
        <div className="no-print mb-6">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-xl shadow-slate-900/5">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/40 via-transparent to-rose-50/40 pointer-events-none" />

            <div className="relative p-6">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      OT ޝީޓް ކޮންޓްރޯލް
                    </h3>
                    <p className="text-sm text-slate-600">
                      {`${firstDate.day} ${ENGLISH_MONTHS[prevMonth0]} ${prevYear} → ${lastDate.day} ${ENGLISH_MONTHS[endMonth]} ${endYear}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={printOnePage}
                  className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 font-bold text-white shadow-lg shadow-slate-900/25 transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  ޕްރިންޓް
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                {/* Imam */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    އިމާމް
                  </label>
                  <Select
                    value={imamKey}
                    onValueChange={(v) => setImamKey(v as ImamOptionKey)}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold">
                      <SelectValue placeholder="Select imam" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(IMAM_INFO) as ImamOptionKey[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {IMAM_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* End Month */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    މަސް (10ވަނަ ދުވަހުން ނިމޭ)
                  </label>
                  <Select
                    value={String(endMonth)}
                    onValueChange={(v) => setEndMonth(Number(v))}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold">
                      <SelectValue placeholder="Select end month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* End Year */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    އަހަރު
                  </label>
                  <input
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-center text-sm font-bold"
                    type="number"
                    value={endYear}
                    onChange={(e) =>
                      setEndYear(Number(e.target.value || now.getFullYear()))
                    }
                  />
                </div>

                {/* OT minutes */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    OT (މިނަޓް)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={480}
                    step={1}
                    value={otMinutes}
                    onChange={(e) =>
                      setOtMinutes(clampInt(Number(e.target.value), 0, 480))
                    }
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-center text-sm font-bold"
                  />
                </div>

                {/* View Range */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    View
                  </label>
                  <select
                    className="h-11 w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold"
                    value={viewSelect}
                    onChange={(e) => setViewSelect(e.target.value as RangeKey)}
                  >
                    <option value="A">{ranges.A.label}</option>
                    <option value="B">{ranges.B.label}</option>
                    <option value="BOTH">{ranges.BOTH.label}</option>
                  </select>
                </div>

                {/* Print Range */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Print
                  </label>
                  <select
                    className="h-11 w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold"
                    value={printSelect}
                    onChange={(e) =>
                      setPrintSelect(e.target.value as RangeKey)
                    }
                  >
                    <option value="A">{ranges.A.label}</option>
                    <option value="B">{ranges.B.label}</option>
                    <option value="BOTH">{ranges.BOTH.label}</option>
                  </select>
                </div>
              </div>

              {/* Employee fields */}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    ނަން
                  </label>
                  <input
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    މަޤާމް
                  </label>
                  <input
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold"
                    value={empPosition}
                    onChange={(e) => setEmpPosition(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    އައިޑީ ނަންބަރު
                  </label>
                  <input
                    className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold"
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                  />
                </div>
              </div>

              {/* Holiday picker */}
              <div className="mt-6 overflow-hidden rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      ބަންދު ދުވަސްތައް (Click to toggle)
                    </h4>
                    <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                      {sortedHolidayDates.length} day
                      {sortedHolidayDates.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHolidayDates(new Set())}
                    className="rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-4 p-4">
                  {rangeByMonth.map((grp) => (
                    <div key={`${grp.year}-${grp.month0}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          {ENGLISH_MONTHS[grp.month0]} {grp.year}
                        </span>
                        <span className="h-px flex-1 bg-slate-200" />
                      </div>
                      <div className="grid grid-cols-7 gap-2 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-15">
                        {grp.items.map((d) => {
                          const isHoliday = holidayDates.has(d.iso);
                          const isWeekend =
                            d.weekday === 5 || d.weekday === 6;
                          return (
                            <button
                              key={d.iso}
                              type="button"
                              onClick={() => toggleHoliday(d.iso)}
                              className={[
                                "flex flex-col items-center justify-center rounded-lg border-2 px-1 py-1.5 text-xs font-bold transition-all",
                                isHoliday
                                  ? "border-amber-500 bg-amber-100 text-amber-900 shadow-sm"
                                  : isWeekend
                                    ? "border-slate-300 bg-slate-50 text-slate-600 hover:border-amber-300"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-amber-300",
                              ].join(" ")}
                              title={DHIVEHI_WEEKDAYS[d.weekday]}
                            >
                              <span className="text-sm">{d.day}</span>
                              <span className="text-[10px] opacity-70">
                                {DHIVEHI_WEEKDAYS[d.weekday]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Empty rules */}
              <div className="mt-6 overflow-hidden rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white">
                <div className="border-b border-slate-200 bg-white px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Exclude Prayers
                    </h4>
                    <span className="ml-auto rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                      {Object.keys(emptyRules).length} active
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[160px]">
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Day
                      </label>
                      <select
                        className="h-11 w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold"
                        value={emptyIso}
                        onChange={(e) => setEmptyIso(e.target.value)}
                      >
                        {(sortedHolidayDates.length === 0
                          ? rangeDates
                          : sortedHolidayDates
                        ).map((d) => (
                          <option key={d.iso} value={d.iso}>
                            {englishDateLabel(d.year, d.month0, d.day)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-[140px]">
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Prayer
                      </label>
                      <select
                        className="h-11 w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold"
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
                      onClick={() => addEmptyRule(emptyIso, emptyPrayer)}
                      className="h-11 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white shadow-lg hover:bg-slate-800"
                    >
                      Apply
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmptyRules({})}
                      className="h-11 rounded-xl border-2 border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                    >
                      Clear All
                    </button>
                  </div>

                  {Object.keys(emptyRules).length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(emptyRules)
                        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                        .map(([iso, rules]) => {
                          const keys = GROUPS.filter((g) => rules[g.key]).map(
                            (g) => g.key,
                          );
                          const parts = iso.split("-");
                          const label =
                            keys.length === GROUPS.length
                              ? `${parts[2]}/${parts[1]}: All`
                              : `${parts[2]}/${parts[1]}: ${keys.map(groupLabel).join("، ")}`;
                          return (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => removeEmptyRule(iso, "ALL")}
                              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-50"
                              title="Remove"
                            >
                              {label} ✕
                            </button>
                          );
                        })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Screen view (selected view range only) ===== */}
        <div id="view-area" className="bg-white">
          {renderTable(viewRows)}
        </div>

        {/* ===== Print clone (selected print range only) ===== */}
        <div id="print-area" className="bg-white">
          {renderTable(printRows)}
        </div>

        {/* status */}
        {timesError ? (
          <div className="no-print mt-2 text-right text-sm text-red-600">
            {timesError}
          </div>
        ) : loadingTimes ? (
          <div className="no-print mt-2 text-right text-sm text-neutral-600">
            Loading prayer times...
          </div>
        ) : null}

        {/* Unused local for lint-safety */}
        {endMonthLabel ? null : null}
      </div>
    </div>
  );
}
