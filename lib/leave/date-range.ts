const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

export function displayLeaveDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function nextWorkingDayAfter(value: string): string {
  const date = parseIsoDate(value);
  if (!date) throw new Error("Invalid leave end date");
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 5 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

export function parseLeaveDateRange(start: string, end: string) {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate || !endDate || endDate < startDate) {
    throw new Error("Select a valid leave date range");
  }
  const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
  if (durationDays > 365) {
    throw new Error("Leave date range cannot exceed 365 days");
  }
  return {
    startDate: start,
    endDate: end,
    durationDays,
  };
}

export function templateDaysForRange(startDate: string, endDate: string, time: string, reason: string) {
  const range = parseLeaveDateRange(startDate, endDate);
  const dateRange = range.durationDays === 1
    ? displayLeaveDate(range.startDate)
    : `${displayLeaveDate(range.startDate)} - ${displayLeaveDate(range.endDate)}`;
  return {
    date: range.durationDays === 1 ? dateRange : undefined,
    secondDay: range.durationDays === 2 ? { date: dateRange, time, reason } : undefined,
    additionalDetails: range.durationDays > 2 ? { date: dateRange, time, reason } : undefined,
  };
}
