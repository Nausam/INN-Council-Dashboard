"use client";

import {
  EmployeePortalHeader,
  EmployeePortalHeaderButton,
} from "@/components/employee-portal/EmployeePortalHeader";
import {
  EmptyState,
  PageShell,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { useUser } from "@/Providers/UserProvider";
import type {
  AttendanceDoc,
  EmployeeDoc,
  EmployeeLeaveCalendarEntry,
  MosqueAttendanceDoc,
} from "@/lib/firebase/types";
import {
  buildAttendanceSummary,
  buildLastWeekAttendance,
  WORK_WEEK_DAYS,
  currentLimitedLeaveRemaining,
  formatDateLabel,
  formatMoney,
  leaveLabel,
  maldivesTodayIso,
  toEmployeeDetailsView,
  type AttendanceSummary,
  type EmployeeDetailsView,
  type LeaveBalanceView,
  type WeekDayAttendance,
} from "@/lib/employees/details-dashboard";
import { cn } from "@/lib/utils";
import { LAST_EMPLOYEE_PROFILE_KEY, isStandaloneApp } from "@/lib/employee-profile-pwa";
import { rememberEmployeeProfile, wasServedFromDeviceCache } from "@/lib/employee-profile-cache";
import { employeePhotoUrl } from "@/lib/employees/photo";
import { AvatarPhoto } from "@/components/design-system/avatar-photo";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CircleSlash,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Edit3,
  FileText,
  Home,
  IdCard,
  Landmark,
  LayoutGrid,
  MapPin,
  MoonStar,
  Phone,
  ShieldCheck,
  Sun,
  TimerOff,
  User,
  UtensilsCrossed,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { salarySlipsByRecordQueryOptions } from "@/hooks/queries";
import { queryKeys } from "@/lib/query/keys";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./employee-details.module.css";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import { leaveVisual, type GlossTone } from "@/lib/employees/leave-visuals";

type TabId = "overview" | "attendance" | "leave" | "pay" | "requests";

// Loaded on first use: only admins edit, and Requests is its own screen.
const loadRequestsView = () =>
  import("../../[id]/requests/EmployeeRequestsPageView").then((mod) => mod.EmployeeRequestsPageView);
const EmployeeRequestsPageView = dynamic(loadRequestsView, { loading: () => <DetailsSkeleton /> });
const EmployeeEditModal = dynamic(
  () => import("@/components/Modals/EmployeeEditModal").then((mod) => mod.EmployeeEditModal),
);

const tabs: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "attendance", label: "Attend", icon: Clock3 },
  { id: "leave", label: "Leave", icon: WalletCards },
  { id: "pay", label: "Pay", icon: Banknote },
];

const statusMeta: Record<WeekDayAttendance["status"], { icon: LucideIcon }> = {
  present: { icon: CheckCircle2 },
  late: { icon: AlarmClock },
  leave: { icon: CalendarDays },
  absent: { icon: CircleSlash },
};

const mosquePrayerFields = [
  ["Fathis", "fathisSignInTime"],
  ["Mendhuru", "mendhuruSignInTime"],
  ["Asuru", "asuruSignInTime"],
  ["Magrib", "maqribSignInTime"],
  ["Isha", "ishaSignInTime"],
] as const;

function formatPrayerTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Indian/Maldives",
  });
}

export function EmployeeDetailsDashboardView({
  employee: data,
  leaves = [],
  councilAttendance = [],
  mosqueAttendance = [],
  recentCouncilAttendance = [],
  recentMosqueAttendance = [],
  initialTab = "overview",
}: {
  employee: EmployeeDoc | null;
  leaves?: EmployeeLeaveCalendarEntry[];
  councilAttendance?: AttendanceDoc[];
  mosqueAttendance?: MosqueAttendanceDoc[];
  /** This month and last, so last week is complete early in a month. */
  recentCouncilAttendance?: AttendanceDoc[];
  recentMosqueAttendance?: MosqueAttendanceDoc[];
  initialTab?: TabId;
}) {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useUser();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<TabId>(initialTab);
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  useEffect(() => {
    if (!id || !isStandaloneApp()) return;
    try {
      if (data) window.localStorage.setItem(LAST_EMPLOYEE_PROFILE_KEY, id);
      else window.localStorage.removeItem(LAST_EMPLOYEE_PROFILE_KEY);
    } catch {
      // The profile remains usable when browser storage is unavailable.
    }
    if (data) void rememberEmployeeProfile(id);
  }, [data, id]);

  // The installed app opens on the copy saved from the last visit; fetch
  // today's records straight away and swap them in.
  useEffect(() => {
    let active = true;
    void wasServedFromDeviceCache().then((cached) => {
      if (active && cached) router.refresh();
    });
    return () => {
      active = false;
    };
  }, [router]);

  // Warm the Requests screen so its tab opens without a wait.
  useEffect(() => {
    const timer = window.setTimeout(() => void loadRequestsView(), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  // The leave calendar and salary slips pages read from the query cache, so
  // hand them what this page already has and they open without waiting.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!id || !data) return;
    queryClient.setQueryData(queryKeys.employees.detail(id), data);
    queryClient.setQueryData(queryKeys.employees.leaveCalendar(id), leaves);
  }, [data, id, leaves, queryClient]);
  const recordCard = typeof data?.recordCardNumber === "string" ? data.recordCardNumber.trim() : "";
  useEffect(() => {
    if (tab !== "pay" || !recordCard) return;
    void queryClient.prefetchQuery(salarySlipsByRecordQueryOptions(recordCard));
  }, [queryClient, recordCard, tab]);

  const isPending = false;
  const isError = !data;
  const leavesPending = false;
  const councilPending = false;
  const mosquePending = false;

  const employee = useMemo(
    () => (data ? toEmployeeDetailsView(data) : null),
    [data],
  );

  const attendanceSummary = useMemo(() => {
    if (!id) {
      return buildAttendanceSummary({
        employeeId: "",
        councilAttendance: [],
        mosqueAttendance: [],
        leaves: [],
      });
    }

    return buildAttendanceSummary({
      employeeId: id,
      councilAttendance,
      mosqueAttendance,
      leaves,
    });
  }, [councilAttendance, id, leaves, mosqueAttendance]);

  const lastWeekDays = useMemo(
    () => id
      ? buildLastWeekAttendance({
        employeeId: id,
        councilAttendance: recentCouncilAttendance,
        mosqueAttendance: recentMosqueAttendance,
        leaves,
      })
      : [],
    [id, leaves, recentCouncilAttendance, recentMosqueAttendance],
  );

  // Leave days still ahead, earliest first, one entry per date.
  const upcomingLeave = useMemo(() => {
    const todayIso = maldivesTodayIso();
    const byDate = new Map<string, EmployeeLeaveCalendarEntry>();
    for (const entry of leaves) {
      if (entry.date > todayIso && !byDate.has(entry.date)) byDate.set(entry.date, entry);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [leaves]);

  const loading = isPending || leavesPending || councilPending || mosquePending;

  if (isPending && !employee) {
    return <DetailsSkeleton />;
  }

  if (isError || !employee || !id) {
    return (
      <PageShell className="bg-white">
        <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
        <EmptyState
          icon={User}
          title="Employee not found"
          description="The employee you're looking for doesn't exist or has been removed."
          action={
            <Button
              type="button"
              variant="council"
              className="rounded-full"
              onClick={() => router.push("/employees/details")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to search
            </Button>
          }
        />
      </PageShell>
    );
  }

  const annualRemaining = currentLimitedLeaveRemaining(employee, "annualLeave");

  if (tab === "requests") {
    return (
      <EmployeeRequestsPageView
        employee={data}
        employeeId={id}
        onTabChange={setTab}
      />
    );
  }

  return (
    <div className={styles.page}>
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>

      <EmployeePortalHeader
        className={styles.wrap}
        actions={
          isAdmin ? (
            <EmployeePortalHeaderButton label="Edit profile" onClick={() => setEditOpen(true)}>
              <Edit3 />
            </EmployeePortalHeaderButton>
          ) : null
        }
      />

      <div className={styles.wrap}>
        {tab === "overview" ? (
          <ProfileHeader
            employee={employee}
            summary={attendanceSummary}
            annualRemaining={annualRemaining}
            upcomingLeave={upcomingLeave}
            photoUrl={employeePhotoUrl(id, data?.photoKey)}
          />
        ) : null}

        <nav className={styles.tabs} aria-label="Employee details sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn(
                styles.tab,
                tab === t.id && styles.tabActive,
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
          <button type="button" onClick={() => setTab("requests")} className={styles.tab}>
            <FileText className="h-4 w-4" />
            Requests
          </button>
        </nav>

        <div className={styles.content}>
          {tab === "overview" ? (
            <OverviewSection
              employee={employee}
              employeeId={id}
              summary={attendanceSummary}
              upcomingLeave={upcomingLeave}
            />
          ) : null}
          {tab === "attendance" ? (
            <AttendanceSection
              employee={employee}
              summary={attendanceSummary}
              mosqueAttendance={mosqueAttendance}
              lastWeekDays={lastWeekDays}
              loading={loading}
            />
          ) : null}
          {tab === "leave" ? (
            <LeaveSection employee={employee} employeeId={id} />
          ) : null}
          {tab === "pay" ? (
            <PaySection
              employee={employee}
              employeeId={id}
            />
          ) : null}
        </div>
      </div>

      <nav className={styles.mobileNav} aria-label="Employee details sections">
        <div className={styles.mobileNavInner}>
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(styles.mobileTab, active && styles.mobileTabActive)}
                aria-current={active ? "page" : undefined}
              >
                <t.icon />
                <span>{t.label}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => setTab("requests")} className={styles.mobileTab}>
            <FileText />
            <span>Requests</span>
          </button>
        </div>
      </nav>

      <EmployeeEditModal
        employeeId={id}
        open={editOpen}
        onOpenChange={setEditOpen}
        previewName={employee.name}
      />
    </div>
  );
}

/* ---------------- Loading skeleton ---------------- */

/**
 * Placeholder while records load. Given the employee's name it shows the real
 * hero straight away, so only the numbers below are still pulsing.
 */
export function DetailsSkeleton({
  name,
  designation,
  photoUrl,
}: {
  name?: string;
  designation?: string;
  photoUrl?: string;
}) {
  return (
    <div className={styles.page}>
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
      <EmployeePortalHeader className={styles.wrap} />
      <div className={styles.wrap}>
        <div className={styles.profileHeader}>
          <div className={styles.hero}>
            {name ? (
              <div className={cn(styles.heroMain, photoUrl && styles.heroMainCentered)}>
                <div className={styles.heroText}>
                  <p className={cn(styles.eyebrow, styles.heroKicker)}>Employee profile</p>
                  <h1 className={styles.name}>{name}</h1>
                  <p className={styles.designation}>
                    <BriefcaseBusiness className="h-4 w-4 shrink-0" />
                    {designation || "No designation"}
                  </p>
                  <div className={styles.heroMeta}>
                    <div className="h-8 w-40 animate-pulse rounded-full bg-white/70" />
                  </div>
                </div>
                <div
                  className={cn(styles.avatar, photoUrl && styles.avatarPhoto)}
                  aria-hidden={photoUrl ? undefined : true}
                >
                  {name.trim().charAt(0).toUpperCase() || "?"}
                  {photoUrl ? <AvatarPhoto src={photoUrl} alt={name} loading="eager" /> : null}
                </div>
              </div>
            ) : (
              <div className={styles.heroMain}>
                <div className="space-y-3">
                  <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                  <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-200" />
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-white ring-1 ring-slate-200" />
              </div>
            )}
          </div>
          <div className={styles.stats}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.stat}>
                <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100" />
                <div className="space-y-2">
                  <div className="h-2 w-20 animate-pulse rounded bg-slate-100" />
                  <div className="h-6 w-10 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.panel}>
            <div className="mb-4 h-6 w-28 animate-pulse rounded bg-slate-100" />
            <div className={styles.identityList}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-50" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Profile header ---------------- */

function shortClock(value: string | null): string {
  return (value ?? "").replace(/^0/, "");
}

/** What today looks like so far, for the pill in the hero. */
function todayStatus(days: WeekDayAttendance[], todayIso: string): { tone: GlossTone; icon: LucideIcon; text: string } {
  const today = days.find((day) => day.date === todayIso);
  if (!today) return { tone: "neutral", icon: Sun, text: "Weekend" };
  if (today.status === "leave") return { tone: "leave", icon: CalendarDays, text: today.note };
  if (today.status === "late") {
    return { tone: "late", icon: AlarmClock, text: `In ${shortClock(today.signInTime)} · +${today.lateMinutes}m` };
  }
  if (today.status === "present") {
    return { tone: "present", icon: CheckCircle2, text: `In ${shortClock(today.signInTime)}` };
  }
  return { tone: "pending", icon: Clock3, text: "No sign-in yet" };
}

/** "2 yrs 6 mos" since the joining date, or null when it can't be read. */
function tenureLabel(joinedDate: string, todayIso: string): string | null {
  const joined = /^(\d{4})-(\d{2})-(\d{2})/.exec(joinedDate);
  if (!joined) return null;
  const [year, month, day] = todayIso.split("-").map(Number);
  const months =
    (year - Number(joined[1])) * 12 + (month - Number(joined[2])) - (day < Number(joined[3]) ? 1 : 0);
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years ? `${years} ${years === 1 ? "yr" : "yrs"}` : null,
    rest ? `${rest} ${rest === 1 ? "mo" : "mos"}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "Joined this month";
}

function ProfileHeader({
  employee,
  summary,
  annualRemaining,
  upcomingLeave,
  photoUrl,
}: {
  employee: EmployeeDetailsView;
  summary: AttendanceSummary;
  annualRemaining: number;
  upcomingLeave: EmployeeLeaveCalendarEntry[];
  photoUrl?: string;
}) {
  const todayIso = maldivesTodayIso();
  const today = todayStatus(summary.weekDays, todayIso);
  const TodayIcon = today.icon;
  const lateDays = summary.weekDays.filter((day) => day.status === "late").length;
  const annualAllowance =
    employee.leaveBalances.find((item) => item.key === "annualLeave")?.allowance ?? null;
  const nextLeave = upcomingLeave[0];

  return (
    <section className={styles.profileHeader} aria-label="Employee profile">
      <div className={styles.hero}>
        <div className={cn(styles.heroMain, photoUrl && styles.heroMainCentered)}>
          <div className={styles.heroText}>
            <p className={cn(styles.eyebrow, styles.heroKicker)}>Employee profile</p>
            <h1 className={styles.name}>{employee.name}</h1>
            <p className={styles.designation}>
              <BriefcaseBusiness className="h-4 w-4 shrink-0" />
              {employee.designation || "No designation"}
            </p>
            <div className={styles.heroMeta}>
              <span className={styles.todayPill}>
                <span className={cn(motifs.glossIcon, styles.todayPillIcon)} data-tone={today.tone}>
                  <TodayIcon />
                </span>
                <small>Today</small>
                {today.text}
              </span>
            </div>
          </div>
          <div
            className={cn(styles.avatar, photoUrl && styles.avatarPhoto)}
            aria-hidden={photoUrl ? undefined : true}
          >
            {employee.name.trim().charAt(0).toUpperCase() || "?"}
            {photoUrl ? <AvatarPhoto src={photoUrl} alt={employee.name} loading="eager" /> : null}
          </div>
        </div>
      </div>

      <div className={styles.stats}>
        <MiniStat
          icon={CheckCircle2}
          tone="present"
          value={String(summary.presentDays)}
          unit={`/ ${WORK_WEEK_DAYS}`}
          label="Present this week"
          note={
            <span className={styles.statDots} aria-hidden="true">
              {summary.weekDays.map((day) => (
                <span key={day.date} data-status={day.date > todayIso ? "upcoming" : day.status} />
              ))}
            </span>
          }
        />
        <MiniStat
          icon={TimerOff}
          tone="late"
          value={String(summary.lateMinutes)}
          unit="min"
          label="Late this week"
          note={<span className={styles.statNote}>{lateDays} {lateDays === 1 ? "late day" : "late days"}</span>}
        />
        <MiniStat
          icon={CalendarDays}
          tone="leave"
          value={String(summary.leaveDaysThisMonth)}
          unit={summary.leaveDaysThisMonth === 1 ? "day" : "days"}
          label="Leave this month"
          note={
            <span className={styles.statNote}>
              {nextLeave ? `Next ${formatDateLabel(nextLeave.date).replace(/,? \d{4}$/, "")}` : "None planned"}
            </span>
          }
        />
        <MiniStat
          icon={WalletCards}
          tone="annual"
          value={String(annualRemaining)}
          unit={annualAllowance !== null ? `/ ${annualAllowance}` : "days"}
          label="Annual days left"
          bar={annualAllowance ? Math.min(1, Math.max(0, annualRemaining / annualAllowance)) : undefined}
        />
      </div>
    </section>
  );
}

function MiniStat({
  icon: Icon,
  tone,
  value,
  unit,
  label,
  note,
  bar,
}: {
  icon: LucideIcon;
  tone: GlossTone;
  value: string;
  unit?: string;
  label: string;
  note?: React.ReactNode;
  /** 0–1 share for a small progress bar under the value. */
  bar?: number;
}) {
  return (
    <div className={styles.stat} data-tone={tone}>
      <div className={styles.statTop}>
        <div className={cn(motifs.glossIcon, styles.statIcon)} data-tone={tone}>
          <Icon />
        </div>
        {note}
      </div>
      <div className={styles.statBody}>
        <p className={styles.statLabel}>{label}</p>
        <p className={styles.statValue}>
          {value}
          {unit ? <small>{unit}</small> : null}
        </p>
        {bar !== undefined ? (
          <div className={styles.statBar}>
            <span style={{ width: `${bar * 100}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function OverviewSection({
  employee,
  employeeId,
  summary,
  upcomingLeave,
}: {
  employee: EmployeeDetailsView;
  employeeId: string;
  summary: AttendanceSummary;
  upcomingLeave: EmployeeLeaveCalendarEntry[];
}) {
  const todayIso = maldivesTodayIso();

  return (
    <div className={styles.overviewGrid}>
      <Panel icon={IdCard} title="Identity">
        <div className={styles.identityList}>
          <IdentityRow
            icon={IdCard}
            tone="annual"
            label="Record card"
            value={employee.recordCardNumber}
          />
          <IdentityRow
            icon={ShieldCheck}
            tone="present"
            label="Device ID"
            value={employee.deviceUserId}
          />
          <IdentityRow
            icon={CalendarCheck}
            tone="late"
            label="Joined"
            value={employee.joinedDate ? formatDateLabel(employee.joinedDate) : ""}
            hint={employee.joinedDate ? tenureLabel(employee.joinedDate, todayIso) : null}
          />
          <IdentityRow
            icon={MapPin}
            tone="leave"
            label="Address"
            value={employee.address}
          />
        </div>
      </Panel>

      <Panel icon={Clock3} title="This week">
        <div className={styles.overviewWeek}>
          <WeekStrip days={summary.weekDays} todayIso={todayIso} />

          <UpcomingLeave upcomingLeave={upcomingLeave} />
          <LeaveCalendarLink employeeId={employeeId} />
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Attendance ---------------- */

function AttendanceSection({
  employee,
  summary,
  mosqueAttendance,
  lastWeekDays,
  loading,
}: {
  employee: EmployeeDetailsView;
  summary: AttendanceSummary;
  mosqueAttendance: MosqueAttendanceDoc[];
  lastWeekDays: WeekDayAttendance[];
  loading: boolean;
}) {
  const balanceByKey = useMemo(
    () => new Map(employee.leaveBalances.map((b) => [b.key, b])),
    [employee.leaveBalances],
  );

  return (
    <div className={styles.stack}>
      <Panel icon={Clock3} title="This week">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: WORK_WEEK_DAYS }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <AttendanceWeek days={summary.weekDays} balanceByKey={balanceByKey} />
        )}
      </Panel>

      {!loading && lastWeekDays.length > 0 ? (
        <Panel icon={CalendarDays} title="Last week">
          <AttendanceWeek days={lastWeekDays} balanceByKey={balanceByKey} />
        </Panel>
      ) : null}

      {mosqueAttendance.length > 0 ? (
        <Panel icon={MoonStar} title="Mosque prayer sign-ins">
          <div className={styles.stack}>
            {mosqueAttendance.slice(0, 6).map((row) => (
              <div key={row.$id} className={styles.prayerItem}>
                <p className={styles.prayerDate}>
                  {formatDateLabel(row.date)}
                </p>
                <div className={styles.prayerGrid}>
                  {mosquePrayerFields.map(([label, field]) => (
                    <div
                      key={field}
                      className={styles.prayerCell}
                    >
                      <small>
                        {label}
                      </small>
                      <strong>
                        {formatPrayerTime(row[field])}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

// The sign-in bar covers the usual arrival window, 6 to 10 AM.
const RIBBON_START = 6 * 60;
const RIBBON_END = 10 * 60;

function minutesFromClock(value: string | null): number | null {
  const match = value ? /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(value) : null;
  if (!match) return null;
  const hours = (Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return hours * 60 + Number(match[2]);
}

function ribbonPercent(minutes: number): number {
  const ratio = (minutes - RIBBON_START) / (RIBBON_END - RIBBON_START);
  return Math.min(100, Math.max(0, ratio * 100));
}

/** Whole days from one YYYY-MM-DD date to another. */
function daysBetween(fromIso: string, toIso: string): number {
  const day = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / day);
}

/** Short line under each day in the week strip. */
function weekStripCaption(day: WeekDayAttendance, upcoming: boolean): string {
  if (upcoming) return day.label.split(" ")[0] ?? "";
  if (day.status === "leave") return "Leave";
  const signIn = minutesFromClock(day.signInTime);
  if (signIn === null) return "—";
  return `${Math.floor(signIn / 60) % 12 || 12}:${String(signIn % 60).padStart(2, "0")}`;
}

function WeekStrip({ days, todayIso }: { days: WeekDayAttendance[]; todayIso: string }) {
  return (
    <div className={styles.weekStrip} aria-hidden="true">
      {days.map((day) => {
        const upcoming = day.date > todayIso;
        const StatusIcon = statusMeta[day.status].icon;
        return (
          <div
            key={day.date}
            className={styles.weekStripDay}
            data-status={upcoming ? "upcoming" : day.status}
            data-today={day.date === todayIso ? "" : undefined}
          >
            <span className={styles.weekStripTile}>
              {upcoming ? day.label.split(" ")[1] ?? day.label : <StatusIcon />}
            </span>
            <small>{day.day.charAt(0)}</small>
            <span className={styles.weekStripMeta}>{weekStripCaption(day, upcoming)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** A tear-off calendar page: colored band with binder holes, big number, caption. */
function CalendarPage({ top, number, caption, title }: { top: string; number: string; caption: string; title?: string }) {
  return (
    <div className={motifs.calendarPage} title={title}>
      <span className={motifs.calendarPageTop}>{top}</span>
      <strong>{number}</strong>
      <small>{caption}</small>
    </div>
  );
}

function AttendanceWeek({
  days,
  balanceByKey,
}: {
  days: WeekDayAttendance[];
  balanceByKey: Map<string, LeaveBalanceView>;
}) {
  const todayIso = maldivesTodayIso();
  // Days that haven't started can't have a record yet, so they're listed
  // separately instead of showing as "No record". Cards run Sunday to
  // Thursday, the same order as the strip above them.
  const started = days.filter((day) => day.date <= todayIso);
  const upcoming = days.filter((day) => day.date > todayIso);

  return (
    <div className={styles.attendanceWeek}>
      <WeekStrip days={days} todayIso={todayIso} />

      {started.length > 0 ? (
        <ol className={styles.dayList}>
          {started.map((day) => (
            <AttendanceDay
              key={day.date}
              day={day}
              isToday={day.date === todayIso}
              leaveBalance={day.leaveType ? balanceByKey.get(day.leaveType) : undefined}
            />
          ))}
        </ol>
      ) : null}

      {upcoming.length > 0 ? (
        <div className={styles.upcoming}>
          <div className={styles.upcomingHead}>
            <p className={styles.upcomingLabel}>Coming up</p>
            <span className={styles.upcomingCount}>
              {upcoming.length} {upcoming.length === 1 ? "workday" : "workdays"} left
            </span>
          </div>
          <div
            className={styles.upcomingDays}
            style={{ "--upcoming-count": upcoming.length } as React.CSSProperties}
          >
            {upcoming.map((day) => {
              const away = daysBetween(todayIso, day.date);
              return (
                <CalendarPage
                  key={day.date}
                  top={day.day}
                  number={day.label.split(" ")[1] ?? day.label}
                  caption={away === 1 ? "Tomorrow" : `In ${away} days`}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AttendanceDay({
  day,
  isToday,
  leaveBalance,
}: {
  day: WeekDayAttendance;
  isToday: boolean;
  leaveBalance?: LeaveBalanceView;
}) {
  const StatusIcon = statusMeta[day.status].icon;
  // Mosque sign-ins are spread across the day, so only council sign-ins get the bar.
  const signIn = day.source === "Council" ? minutesFromClock(day.signInTime) : null;
  const expected = signIn !== null && day.lateMinutes > 0 ? signIn - day.lateMinutes : null;
  const onTimeEnd = expected ?? signIn;

  return (
    <li className={styles.dayCard} data-status={day.status}>
      <div className={styles.dayHead}>
        <div className={styles.attendanceDate} data-status={day.status}>
          <small>{day.day}</small>
          <strong>{day.label.split(" ")[1] ?? day.label}</strong>
        </div>
        <div className={styles.attendanceBody}>
          <div className={styles.attendanceNote}>
            <StatusIcon className="h-4 w-4 shrink-0" />
            <p className="truncate">{day.note}</p>
            {isToday ? <span className={styles.todayTag}>Today</span> : null}
          </div>
          <p className={styles.attendanceSource}>
            {leaveBalance
              ? leaveBalance.allowance !== null
                ? `${leaveBalance.used} of ${leaveBalance.allowance} used this year`
                : `${leaveBalance.used} taken this year`
              : day.source === "None"
                ? "No sign-in recorded"
                : day.source}
          </p>
        </div>
        {leaveBalance ? (
          <span className={styles.attendanceBadge}>
            {leaveBalance.allowance !== null
              ? `${leaveBalance.used}/${leaveBalance.allowance}`
              : `${leaveBalance.used}`}
          </span>
        ) : day.lateMinutes > 0 ? (
          <span className={styles.attendanceBadge} data-tone="late">
            +{day.lateMinutes}m
          </span>
        ) : null}
      </div>

      {signIn !== null && onTimeEnd !== null ? (
        <div className={styles.ribbon} role="img" aria-label={`Signed in at ${day.signInTime}`}>
          <div className={styles.ribbonTrack}>
            <span className={styles.ribbonFill} style={{ width: `${ribbonPercent(onTimeEnd)}%` }} />
            {expected !== null ? (
              <>
                <span
                  className={styles.ribbonLate}
                  style={{
                    left: `${ribbonPercent(expected)}%`,
                    width: `${ribbonPercent(signIn) - ribbonPercent(expected)}%`,
                  }}
                />
                <span className={styles.ribbonTick} style={{ left: `${ribbonPercent(expected)}%` }} />
              </>
            ) : null}
            <span className={styles.ribbonMarker} style={{ left: `${ribbonPercent(signIn)}%` }} />
          </div>
          <div className={styles.ribbonScale}>
            <span>6 AM</span>
            <span>8 AM</span>
            <span>10 AM</span>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* ---------------- Leave ---------------- */

function LeaveSection({
  employee,
  employeeId,
}: {
  employee: EmployeeDetailsView;
  employeeId: string;
}) {
  const withAllowance = employee.leaveBalances.filter((leave) => leave.allowance !== null);
  const recorded = employee.leaveBalances.filter((leave) => leave.allowance === null);

  return (
    <div className={styles.stack}>
      <LeaveCalendarLink employeeId={employeeId} />

      <Panel icon={WalletCards} title="Leave balances">
        <div className={styles.leaveGrid}>
          {withAllowance.map((leave) => (
            <LeaveBalanceCard key={leave.key} leave={leave} />
          ))}
        </div>

        {recorded.length ? (
          <>
            <p className={styles.recordedTitle}>Recorded leave</p>
            <div className={styles.recordedGrid}>
              {recorded.map((leave) => {
                const meta = leaveVisual(leave.key);
                const Icon = meta.icon;
                const taken = leave.used > 0;
                return (
                  <div key={leave.key} className={styles.recordedRow} data-empty={taken ? undefined : ""}>
                    <span
                      className={cn(motifs.glossIcon, styles.recordedIcon)}
                      data-tone={taken ? meta.tone : "neutral"}
                    >
                      <Icon />
                    </span>
                    <span className={styles.recordedName}>{leave.label.replace(/ Leave$/, "")}</span>
                    <span className={styles.recordedCount}>
                      <strong>{leave.used}</strong>
                      <small>{leave.used === 1 ? "day" : "days"}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </Panel>
    </div>
  );
}

function LeaveCalendarLink({ employeeId }: { employeeId: string }) {
  return (
    <Link href={`/employees/details/${employeeId}/leaves`} prefetch className={styles.featureLink}>
      <span className="flex items-center gap-3">
        <span className={cn(motifs.glossIcon, styles.featureIcon)} data-tone="annual">
          <CalendarDays />
        </span>
        <span>
          <strong>Leave calendar</strong>
          <small>View all recorded leave days</small>
        </span>
      </span>
      <span className={styles.featureArrow}>
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

/** Booked leave days as tear-off calendar pages; nothing when none are booked. */
function UpcomingLeave({ upcomingLeave }: { upcomingLeave: EmployeeLeaveCalendarEntry[] }) {
  const nextLeave = upcomingLeave.slice(0, 4);
  if (!nextLeave.length) return null;
  return (
    <div className={styles.upcoming}>
      <div className={styles.upcomingHead}>
        <p className={styles.upcomingLabel}>Upcoming leave</p>
        <span className={styles.upcomingCount}>
          {upcomingLeave.length} {upcomingLeave.length === 1 ? "day" : "days"} booked
        </span>
      </div>
      <div
        className={styles.upcomingDays}
        style={{ "--upcoming-count": nextLeave.length } as React.CSSProperties}
      >
        {nextLeave.map((entry) => {
          const day = entry.date.split("-")[2] ?? "";
          const monthName = new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-US", { month: "short" });
          const type = leaveLabel(entry.leaveType);
          return (
            <CalendarPage
              key={entry.date}
              top={monthName}
              number={String(Number(day))}
              caption={type.split(" ")[0] || "Leave"}
              title={`${type} · ${formatDateLabel(entry.date)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Pay ---------------- */

/** Icon, color and a short note for each pay field. */
const PAY_VISUALS: Record<string, { icon: LucideIcon; tone: GlossTone; note?: string }> = {
  basicSalary: { icon: Banknote, tone: "present", note: "Monthly" },
  retirementPension: { icon: Landmark, tone: "late", note: "7% of basic" },
  jobAllowance: { icon: BriefcaseBusiness, tone: "leave", note: "Monthly" },
  attendanceBenefit: { icon: CalendarCheck, tone: "annual", note: "Per working day" },
  temporaryZvAllowance: { icon: CalendarDays, tone: "leave", note: "Per working day" },
  ramazanAllowance: { icon: MoonStar, tone: "annual", note: "Monthly" },
  livingAllowance: { icon: Home, tone: "present", note: "Monthly" },
  foodAllowance: { icon: UtensilsCrossed, tone: "late", note: "Monthly" },
  phoneAllowance: { icon: Phone, tone: "leave", note: "Monthly" },
};

function payVisual(key: string): { icon: LucideIcon; tone: GlossTone; note?: string } {
  return PAY_VISUALS[key] ?? { icon: Banknote, tone: "present" };
}

/** Whole months from one date to another (negative when `to` is earlier). */
function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function durationLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [
    years ? `${years} ${years === 1 ? "yr" : "yrs"}` : null,
    rest ? `${rest} ${rest === 1 ? "mo" : "mos"}` : null,
  ].filter(Boolean).join(" ") || "under a month";
}

function PaySection({
  employee,
  employeeId,
}: {
  employee: EmployeeDetailsView;
  employeeId: string;
}) {
  // Net pay is hidden for now; the card links straight to the salary slips.
  return (
    <div className={styles.stack}>
      <Link href={`/employees/details/${employeeId}/salary-slips`} prefetch className={styles.featureLink}>
        <span className="flex items-center gap-3">
          <span className={cn(motifs.glossIcon, styles.featureIcon)} data-tone="present">
            <FileText />
          </span>
          <span>
            <strong>Salary slips</strong>
            <small>View and download your monthly slips</small>
          </span>
        </span>
        <span className={styles.featureArrow}>
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      <Panel icon={WalletCards} title="Pay breakdown">
        {employee.payItems.length > 0 ? (
          <div className={styles.payItems}>
            {employee.payItems.map((item) => {
              const visual = payVisual(item.key);
              const Icon = visual.icon;
              return (
                <div key={item.key} className={styles.payItem}>
                  <span className={cn(motifs.glossIcon, styles.payItemIcon)} data-tone={visual.tone}>
                    <Icon />
                  </span>
                  <span className={styles.payItemName}>
                    {item.label}
                    {visual.note ? <small>{visual.note}</small> : null}
                  </span>
                  <span className={styles.payItemAmount}>
                    <small>MVR</small>
                    {formatMoney(item.value).replace(/^MVR\s*/, "")}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.payEmpty}>No pay fields are set for this employee.</p>
        )}
      </Panel>

      {employee.creditSchemes.length > 0 ? (
        <Panel icon={CreditCard} title="Credit schemes">
          <div className={styles.schemes}>
            {employee.creditSchemes.map((scheme, index) => (
              <CreditSchemeCard key={`${scheme.name}-${index}`} scheme={scheme} />
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function CreditSchemeCard({ scheme }: { scheme: EmployeeDetailsView["creditSchemes"][number] }) {
  const start = new Date(`${scheme.startDate}T00:00:00`);
  const end = new Date(`${scheme.endDate}T00:00:00`);
  const validDates = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
  const now = new Date();
  const progress = validDates
    ? Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())))
    : 0;
  const monthsLeft = validDates ? monthsBetween(now, end) : 0;
  const status = !validDates
    ? null
    : now < start
      ? `Starts in ${durationLabel(Math.max(0, monthsBetween(now, start)))}`
      : now >= end
        ? "Completed"
        : `${Math.round(progress * 100)}% through · ${durationLabel(Math.max(0, monthsLeft))} left`;

  const page = (date: Date, tone: GlossTone, caption: string) => (
    <div className={cn(motifs.calendarPage, styles.schemePage)} data-tone={tone}>
      <span className={motifs.calendarPageTop}>
        {date.toLocaleDateString("en-US", { month: "short" })} {date.getFullYear()}
      </span>
      <strong>{date.getDate()}</strong>
      <small>{caption}</small>
    </div>
  );

  return (
    <div className={styles.scheme}>
      <div className={styles.schemeHead}>
        <span className={cn(motifs.glossIcon, styles.schemeIcon)} data-tone="annual">
          <CreditCard />
        </span>
        <p className={styles.schemeName}>{scheme.name}</p>
        <span className={styles.schemeTag}>Scheme</span>
      </div>

      {validDates ? (
        <div className={styles.schemeTimeline}>
          {page(start, "present", "Start")}
          <div className={styles.schemeTrack}>
            <div className={styles.schemeBar}>
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            {status ? <p className={styles.schemeStatus} suppressHydrationWarning>{status}</p> : null}
          </div>
          {page(end, "annual", "End")}
        </div>
      ) : (
        <p className={styles.schemeStatus}>
          {formatDateLabel(scheme.startDate)} {"→"} {formatDateLabel(scheme.endDate)}
        </p>
      )}

      <div className={styles.schemeAmounts}>
        <div>
          <small>First month</small>
          <strong>{formatMoney(scheme.startMonthAmount)}</strong>
        </div>
        <div>
          <small>Last month</small>
          <strong>{formatMoney(scheme.endMonthAmount)}</strong>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Shared primitives ---------------- */

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div className={styles.panelTitleBlock}>
          <div className={styles.panelIcon}>
            <Icon className="h-5 w-5" />
          </div>
          <h2 className={styles.panelTitle}>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function IdentityRow({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: GlossTone;
  hint?: string | null;
}) {
  const empty = !value;
  return (
    <div className={styles.identityRow}>
      <div className={cn(motifs.glossIcon, styles.identityIcon)} data-tone={tone}>
        <Icon className="h-4 w-4" />
      </div>
      <p className={styles.identityLabel}>{label}</p>
      <p
        className={cn(
          styles.identityValue,
          empty && styles.emptyValue,
        )}
      >
        {empty ? "Not set" : value}
        {!empty && hint ? <span className={styles.identityHint}>{hint}</span> : null}
      </p>
    </div>
  );
}

function LeaveBalanceCard({ leave }: { leave: LeaveBalanceView }) {
  const meta = leaveVisual(leave.key);
  const Icon = meta.icon;
  const allowance = leave.allowance ?? 0;
  const remaining = leave.remaining ?? 0;
  const share = allowance ? Math.min(1, Math.max(0, remaining / allowance)) : 0;

  return (
    <div className={styles.leaveCard} data-tone={meta.tone}>
      <div className={styles.leaveCardTop}>
        <span className={cn(motifs.glossIcon, styles.leaveIcon)} data-tone={meta.tone}>
          <Icon />
        </span>
        <p className={styles.leaveName}>{leave.label}</p>
      </div>
      <div className={styles.leaveCount}>
        <strong>{remaining}</strong>
        <span>of {allowance} left</span>
      </div>
      <div className={styles.leaveMeter}>
        <span style={{ width: `${share * 100}%` }} />
      </div>
      <p className={styles.leaveUsed}>{leave.used} used this year</p>
    </div>
  );
}
