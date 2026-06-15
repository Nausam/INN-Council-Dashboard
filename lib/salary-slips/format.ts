export function formatJoinedDate(value?: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return "-";
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatMvr(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSlipAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "-";
  return formatMvr(amount);
}

export function formatPeriodTitle(periodLabel: string): string {
  const m = periodLabel.match(/^(\d{4})-(\d{2})$/);
  if (!m) return periodLabel.toUpperCase();
  const months = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  const idx = parseInt(m[2], 10) - 1;
  const month = idx >= 0 && idx < 12 ? months[idx] : m[2];
  return `${month} ${m[1]}`;
}

export function periodLabelFromMonthYear(monthName: string, year: string): string {
  const months = [
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
  const idx = months.indexOf(monthName);
  if (idx < 0 || !/^\d{4}$/.test(year)) return "";
  return `${year}-${String(idx + 1).padStart(2, "0")}`;
}
