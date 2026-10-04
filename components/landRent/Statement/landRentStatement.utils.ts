/* eslint-disable @typescript-eslint/no-explicit-any */

export function getThisMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function addMonthsToMonthKey(monthKey: string, delta: number) {
  const [yy, mm] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(yy, mm - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthKeyToFullDate(monthKey: string, day = 1) {
  const [y, m] = monthKey.split("-");
  if (!y || !m) return monthKey;
  const dd = String(day).padStart(2, "0");
  const mm = String(Number(m)).padStart(2, "0");
  return `${dd}-${mm}-${y}`;
}

export function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export function fmtDateDDMMYYYY(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

const DHIVEHI_MONTHS: Record<number, string> = {
  0: "ޖެނުއަރީ",
  1: "ފެބްރުއަރީ",
  2: "މާރިޗް",
  3: "އޭޕްރިލް",
  4: "މޭ",
  5: "ޖޫން",
  6: "ޖުލައި",
  7: "އޯގަސްޓް",
  8: "ސެޕްޓެމްބަރު",
  9: "އޮކްޓޯބަރު",
  10: "ނޮވެމްބަރ",
  11: "ޑިސެމްބަރު",
};

export function fmtDateDhivehi(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  // A calendar date must retain its day even in a browser west of UTC.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const dd = String(dateOnly ? d.getUTCDate() : d.getDate());
  const monthIndex = dateOnly ? d.getUTCMonth() : d.getMonth();
  const monthName = DHIVEHI_MONTHS[monthIndex] ?? "";
  const yyyy = dateOnly ? d.getUTCFullYear() : d.getFullYear();
  return `${dd} ${monthName} ${yyyy}`;
}

export function fmtMonthDhivehi(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const monthName = DHIVEHI_MONTHS[Number(match[2]) - 1];
  return monthName ? `${monthName} ${match[1]}` : monthKey;
}

/** Localize saved fine-period labels as well as newly calculated ones. */
export function fmtStatementPeriodDhivehi(label: string) {
  return label.replace(/\((\d{4}-\d{2})\s*[–—-]\s*(\d{4}-\d{2})\)/g,
    (_range, from: string, to: string) => `(${fmtMonthDhivehi(from)} – ${fmtMonthDhivehi(to)})`,
  );
}

export function fmtDateTimeShort(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function toDatetimeLocalValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
