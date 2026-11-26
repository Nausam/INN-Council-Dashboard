/** One stretch of overtime within a day, in HH:MM 24-hour time. */
export type OvertimeTimeRange = { startTime: string; endTime: string };

export const MAX_OVERTIME_MINUTES = 16 * 60;
export const MAX_OVERTIME_RANGES = 6;

function minutesFromTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Minutes between two HH:MM times; an earlier end runs past midnight. */
export function rangeMinutes(range: OvertimeTimeRange): number | null {
  const start = minutesFromTime(range.startTime);
  const end = minutesFromTime(range.endTime);
  if (start === null || end === null) return null;
  return (end - start + 1_440) % 1_440;
}

/** Total minutes across ranges, or null while any range is incomplete. */
export function totalRangeMinutes(ranges: OvertimeTimeRange[]): number | null {
  let total = 0;
  for (const range of ranges) {
    const minutes = rangeMinutes(range);
    if (minutes === null) return null;
    total += minutes;
  }
  return total;
}

/** True when any two ranges share time, including across midnight. */
export function rangesOverlap(ranges: OvertimeTimeRange[]): boolean {
  const spans = ranges.map((range) => {
    const start = minutesFromTime(range.startTime) ?? 0;
    return [start, start + (rangeMinutes(range) ?? 0)] as const;
  });
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      for (const shift of [-1_440, 0, 1_440]) {
        if (spans[i][0] < spans[j][1] + shift && spans[j][0] + shift < spans[i][1]) return true;
      }
    }
  }
  return false;
}

/** Earliest start first, so the stored start and end times frame the day. */
export function sortRanges(ranges: OvertimeTimeRange[]): OvertimeTimeRange[] {
  return [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** A request's ranges; older requests only have a single start and end. */
export function overtimeRangesOf(request: {
  startTime?: string;
  endTime?: string;
  timeRanges?: OvertimeTimeRange[];
}): OvertimeTimeRange[] {
  if (request.timeRanges?.length) return request.timeRanges;
  if (request.startTime && request.endTime) return [{ startTime: request.startTime, endTime: request.endTime }];
  return [];
}
