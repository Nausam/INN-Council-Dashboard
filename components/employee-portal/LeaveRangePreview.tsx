"use client";

import motifs from "@/components/employee-portal/portal-motifs.module.css";
import styles from "@/components/Leave/family-leave-request.module.css";
import type { GlossTone } from "@/lib/employees/leave-visuals";
import { parseLeaveDateRange } from "@/lib/leave/date-range";
import { cn } from "@/lib/utils";

/**
 * Start and end dates as two tear-off calendar pages with the day count
 * between them. Renders nothing until both dates form a valid range.
 */
export function LeaveRangePreview({
  startDate,
  endDate,
  tone,
}: {
  startDate: string;
  endDate: string;
  tone: GlossTone;
}) {
  if (!startDate || !endDate) return null;
  let days: number;
  try {
    days = parseLeaveDateRange(startDate, endDate).durationDays;
  } catch {
    return null;
  }

  const page = (iso: string, label: string) => {
    const date = new Date(`${iso}T00:00:00`);
    return (
      <div className={cn(motifs.calendarPage, styles.rangePage)} data-tone={tone}>
        <span className={motifs.calendarPageTop}>{label}</span>
        <strong>{date.getDate()}</strong>
        <small dir="ltr">{`${date.getMonth() + 1}/${date.getFullYear()}`}</small>
      </div>
    );
  };

  return (
    <div className={styles.range} aria-live="polite">
      {page(startDate, "ފެށޭ")}
      <div className={styles.rangeMid}>
        <strong>{days}</strong>
        <span>ދުވަސް</span>
      </div>
      {page(endDate, "ނިމޭ")}
    </div>
  );
}
