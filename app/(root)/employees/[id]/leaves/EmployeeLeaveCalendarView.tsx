"use client";

import { AvatarGlow, EmptyState } from "@/components/design-system";
import { EmployeePortalMobileNav } from "@/components/employee-portal/EmployeePortalMobileNav";
import { EmployeePortalHeader } from "@/components/employee-portal/EmployeePortalHeader";
import mobileNavStyles from "@/components/employee-portal/EmployeePortalMobileNav.module.css";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import { reverseLeaveTypeMapping } from "@/constants";
import type { EmployeeDoc, EmployeeLeaveCalendarEntry } from "@/lib/firebase/types";
import {
  ADDITIVE_LEAVE_KEYS,
  LEAVE_TOTAL_ALLOWANCE,
  getLeaveUsageSummary,
} from "@/lib/employees/leave-usage";
import { leaveVisual } from "@/lib/employees/leave-visuals";
import { employeePhotoUrl } from "@/lib/employees/photo";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  User,
  type LucideIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import surface from "../employee-portal-surface.module.css";
import styles from "./leave-calendar.module.css";

type LeaveCalendarEntryWithAmount = EmployeeLeaveCalendarEntry & {
  amountLabel: string;
};

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function dateKey(date: Date): string {
  return `${monthKey(date)}-${pad(date.getDate())}`;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLabel(value: string): string {
  return dateFromKey(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function leaveLabel(type: string): string {
  return String(reverseLeaveTypeMapping[type] ?? type);
}

/** Friday and Saturday are the council weekend. */
function isWeekend(date: Date): boolean {
  return date.getDay() === 5 || date.getDay() === 6;
}

function numericField(source: unknown, key: string): number {
  const value = (source as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function leaveAmountLabel(source: unknown, leaveType: string): string {
  const usage = getLeaveUsageSummary(leaveType, numericField(source, leaveType));
  if (usage.remaining !== null) {
    return `${usage.used}/${usage.remaining}`;
  }
  return String(usage.used);
}

function leaveAmountLabelFromSnapshot(
  entry: EmployeeLeaveCalendarEntry,
): string | null {
  const leaveType = entry.leaveType;
  const totalAllowance = LEAVE_TOTAL_ALLOWANCE[leaveType];

  if (ADDITIVE_LEAVE_KEYS.has(leaveType)) {
    return typeof entry.leaveUsedAfter === "number"
      ? String(entry.leaveUsedAfter)
      : null;
  }

  if (totalAllowance !== undefined) {
    if (typeof entry.leaveRemainingAfter !== "number") return null;
    const remaining = Math.max(0, entry.leaveRemainingAfter);
    const used = Math.max(0, totalAllowance - remaining);
    return `${used}/${remaining}`;
  }

  return typeof entry.leaveUsedAfter === "number"
    ? String(entry.leaveUsedAfter)
    : null;
}

function buildLeaveLedgerEntries(
  entries: EmployeeLeaveCalendarEntry[],
  employee: unknown,
): LeaveCalendarEntryWithAmount[] {
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.$id.localeCompare(b.$id),
  );
  const seenByType = new Map<string, number>();

  return sorted.map((entry) => {
    const leaveType = entry.leaveType;
    const seen = (seenByType.get(leaveType) ?? 0) + 1;
    seenByType.set(leaveType, seen);

    const currentValue = numericField(employee, leaveType);
    const totalAllowance = LEAVE_TOTAL_ALLOWANCE[leaveType];
    let amountLabel = leaveAmountLabelFromSnapshot(entry);

    if (amountLabel) {
      return {
        ...entry,
        amountLabel,
      };
    }

    if (ADDITIVE_LEAVE_KEYS.has(leaveType)) {
      amountLabel = String(currentValue + seen);
    } else if (totalAllowance !== undefined) {
      const remaining = Math.max(0, currentValue - seen);
      const used = Math.max(0, totalAllowance - remaining);
      amountLabel = `${used}/${remaining}`;
    } else {
      amountLabel = String(currentValue);
    }

    return {
      ...entry,
      amountLabel,
    };
  });
}

function buildCalendarDates(month: Date): Array<Date | null> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function EmployeeLeaveCalendarView({
  employee,
  leaves,
}: {
  employee: EmployeeDoc | null;
  leaves: EmployeeLeaveCalendarEntry[];
}) {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [monthInitialized, setMonthInitialized] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const goToMonth = (date: Date) => {
    setVisibleMonth(date);
    setSelectedKey(null);
  };

  const ledgerLeaves = useMemo(
    () => buildLeaveLedgerEntries(leaves, employee),
    [employee, leaves],
  );

  useEffect(() => {
    if (monthInitialized || ledgerLeaves.length === 0) return;
    const latest = ledgerLeaves[ledgerLeaves.length - 1];
    if (!latest) return;
    const [year, month] = latest.date.split("-").map(Number);
    setVisibleMonth(new Date(year, month - 1, 1));
    setMonthInitialized(true);
  }, [ledgerLeaves, monthInitialized]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, LeaveCalendarEntryWithAmount[]>();
    for (const entry of ledgerLeaves) {
      const rows = map.get(entry.date) ?? [];
      rows.push(entry);
      map.set(entry.date, rows);
    }
    return map;
  }, [ledgerLeaves]);

  const currentMonthKey = monthKey(visibleMonth);
  const monthRecords = useMemo(
    () => ledgerLeaves.filter((entry) => entry.date.startsWith(currentMonthKey)),
    [currentMonthKey, ledgerLeaves],
  );

  const leaveTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of ledgerLeaves) {
      counts.set(entry.leaveType, (counts.get(entry.leaveType) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) =>
      leaveLabel(a[0]).localeCompare(leaveLabel(b[0])),
    );
  }, [ledgerLeaves]);

  const calendarCells = useMemo(
    () => buildCalendarDates(visibleMonth),
    [visibleMonth],
  );

  const monthName = visibleMonth.toLocaleDateString("en-US", { month: "long" });
  const monthTitle = `${monthName} ${visibleMonth.getFullYear()}`;
  const todayKey = dateKey(new Date());
  const upcomingCount = ledgerLeaves.filter((entry) => entry.date > todayKey).length;
  const visibleRecords =
    selectedKey !== null
      ? recordsByDate.get(selectedKey) ?? []
      : monthRecords;

  if (!employee) {
    return (
      <div className={cn(surface.page, "px-4 py-6")}>
        <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
        <div className="mx-auto max-w-5xl">
          <BackButton onClick={() => router.push("/employees/details")} />
          <EmptyState
            icon={User}
            title="Employee not found"
            description="The employee you're looking for doesn't exist or has been removed."
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(surface.page, mobileNavStyles.pageWithMobileNav, "px-4")}>
      {/* Hide the app's mobile header on this page only */}
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
      <div className={cn(surface.shell, "space-y-5")}>
        <EmployeePortalHeader backHref={`/employees/details/${id}?tab=leave`} />

        {/* Hero */}
        <section className={cn(surface.hero, styles.hero)}>
          <p className={styles.eyebrow}>
            <CalendarDays className="h-4 w-4" />
            Leave calendar
          </p>
          <div className={styles.heroMain}>
            <AvatarGlow
              name={employee.name}
              size="lg"
              src={employeePhotoUrl(employee.$id || id, employee.photoKey)}
              className={cn(surface.avatar, styles.heroAvatar)}
            />
            <div className="min-w-0">
              <h1 className={styles.heroName}>{employee.name}</h1>
              <p className={styles.heroRole}>{employee.designation ?? ""}</p>
            </div>
          </div>

          <div className={styles.heroStats}>
            <HeroStat icon={CalendarDays} tone="annual" value={leaves.length} label="Total days" />
            <HeroStat icon={CalendarRange} tone="leave" value={monthRecords.length} label={`In ${monthName}`} />
            <HeroStat icon={CalendarClock} tone="present" value={upcomingCount} label="Upcoming" />
          </div>
        </section>

        {/* Calendar */}
        <section className={cn(surface.surface, styles.panel)}>
          <div className={styles.monthHead}>
            <h2 className={styles.monthTitle}>
              {monthName}
              <span>{visibleMonth.getFullYear()}</span>
            </h2>
            <div className={styles.monthNav}>
              <button
                type="button"
                aria-label="Previous month"
                className={styles.navButton}
                onClick={() => goToMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className={cn(styles.navButton, styles.todayButton)}
                onClick={() => goToMonth(new Date())}
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                className={styles.navButton}
                onClick={() => goToMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className={styles.grid}>
            {WEEKDAY_INITIALS.map((day, i) => (
              <div key={i} className={styles.weekday} data-weekend={i >= 5 ? "" : undefined}>
                {day}
              </div>
            ))}

            {calendarCells.map((date, index) => {
              if (!date) return <div key={`blank-${index}`} />;
              const key = dateKey(date);
              const dayRecords = recordsByDate.get(key) ?? [];
              const first = dayRecords[0];

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!first}
                  onClick={() => setSelectedKey((prev) => (prev === key ? null : key))}
                  className={cn(styles.day, first && motifs.glossIcon)}
                  data-tone={first ? leaveVisual(first.leaveType).tone : undefined}
                  data-weekend={isWeekend(date) ? "" : undefined}
                  data-today={key === todayKey ? "" : undefined}
                  data-selected={key === selectedKey ? "" : undefined}
                  aria-label={
                    first
                      ? `${formatDateLabel(key)}: ${dayRecords.map((entry) => leaveLabel(entry.leaveType)).join(", ")}`
                      : undefined
                  }
                >
                  <span className={styles.dayNumber}>{date.getDate()}</span>
                  {dayRecords.length > 1 ? <span className={styles.dayCount}>{dayRecords.length}</span> : null}
                </button>
              );
            })}
          </div>
          <p className={styles.gridHint}>Tap a colored day to see its leave.</p>
        </section>

        {/* Records */}
        <section className={cn(surface.surface, styles.panel)}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              {selectedKey ? formatDateLabel(selectedKey) : monthTitle}
            </h2>
            {selectedKey ? (
              <button type="button" onClick={() => setSelectedKey(null)} className={styles.showMonth}>
                Show month
              </button>
            ) : (
              <span className={styles.sectionCount}>
                {monthRecords.length} {monthRecords.length === 1 ? "day" : "days"}
              </span>
            )}
          </div>

          {visibleRecords.length > 0 ? (
            <div className={styles.records}>
              {visibleRecords.map((entry) => {
                const visual = leaveVisual(entry.leaveType);
                const date = dateFromKey(entry.date);
                return (
                  <div key={`${entry.source}-${entry.$id}`} className={styles.record}>
                    <div className={cn(motifs.calendarPage, styles.recordPage)} data-tone={visual.tone}>
                      <span className={motifs.calendarPageTop}>
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <strong>{date.getDate()}</strong>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={styles.recordTitle}>{leaveLabel(entry.leaveType)}</p>
                      <p className={styles.recordMeta}>
                        {formatDateLabel(entry.date)} · {entry.source}
                      </p>
                    </div>
                    <span className={styles.amount} data-tone={visual.tone} title="Used / remaining after this day">
                      {entry.amountLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.empty}>
              {selectedKey ? "No leave on this day." : `No leave in ${monthName}.`}
            </p>
          )}
        </section>

        {/* Leave type summary */}
        <section className={cn(surface.surface, styles.panel)}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Leave types</h2>
          </div>
          {leaveTypeCounts.length > 0 ? (
            <div className={styles.types}>
              {leaveTypeCounts.map(([type, count]) => {
                const visual = leaveVisual(type);
                const Icon = visual.icon;
                return (
                  <div key={type} className={styles.typeRow}>
                    <span className={cn(motifs.glossIcon, styles.typeIcon)} data-tone={visual.tone}>
                      <Icon />
                    </span>
                    <span className={styles.typeName}>
                      {leaveLabel(type)}
                      <small>{count} {count === 1 ? "day" : "days"} recorded</small>
                    </span>
                    <span className={styles.amount} data-tone={visual.tone}>
                      {leaveAmountLabel(employee, type)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.empty}>No leave records found.</p>
          )}
        </section>
      </div>
      {id ? <EmployeePortalMobileNav employeeId={id} active="leave" /> : null}
    </div>
  );
}

function HeroStat({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon;
  tone: "present" | "leave" | "annual";
  value: number;
  label: string;
}) {
  return (
    <div className={cn(surface.softTile, styles.heroStat)}>
      <span className={cn(motifs.glossIcon, styles.heroStatIcon)} data-tone={tone}>
        <Icon />
      </span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(surface.back, "flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95")}
      aria-label="Back"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
