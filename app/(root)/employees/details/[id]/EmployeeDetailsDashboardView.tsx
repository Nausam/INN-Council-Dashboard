"use client";

import { EmployeeEditModal } from "@/components/Modals/EmployeeEditModal";
import {
  EmptyState,
  PageShell,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { useUser } from "@/Providers/UserProvider";
import { useGeneratedSlipForEmployeeQuery } from "@/hooks/queries";
import type {
  AttendanceDoc,
  EmployeeDoc,
  EmployeeLeaveCalendarEntry,
  MosqueAttendanceDoc,
} from "@/lib/firebase/types";
import {
  buildAttendanceSummary,
  currentLimitedLeaveRemaining,
  formatDateLabel,
  formatMoney,
  isAdditiveLeave,
  monthKey,
  toEmployeeDetailsView,
  type AttendanceSummary,
  type EmployeeDetailsView,
  type LeaveBalanceView,
  type WeekDayAttendance,
} from "@/lib/employees/details-dashboard";
import { formatMvr } from "@/lib/salary-slips/format";
import { cn } from "@/lib/utils";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CircleSlash,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  FileText,
  IdCard,
  LayoutGrid,
  MapPin,
  MoonStar,
  ShieldCheck,
  TimerOff,
  User,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./employee-details.module.css";

type TabId = "overview" | "attendance" | "leave" | "pay";

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
  });
}

export function EmployeeDetailsDashboardView({
  employee: data,
  leaves = [],
  councilAttendance = [],
  mosqueAttendance = [],
  initialTab = "overview",
}: {
  employee: EmployeeDoc | null;
  leaves?: EmployeeLeaveCalendarEntry[];
  councilAttendance?: AttendanceDoc[];
  mosqueAttendance?: MosqueAttendanceDoc[];
  initialTab?: TabId;
}) {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useUser();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<TabId>(initialTab);
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const currentMonth = monthKey();
  const isPending = false;
  const isError = !data;
  const leavesPending = false;
  const councilPending = false;
  const mosquePending = false;
  const {
    data: currentSlip = null,
    isPending: slipPending,
    isError: slipError,
  } = useGeneratedSlipForEmployeeQuery(currentMonth, id, {
    enabled: tab === "pay",
  });

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

  return (
    <div className={styles.page}>
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>

      <header className={cn(styles.topbar, styles.wrap)}>
        <div className={styles.breadcrumb}>
          <button
            type="button"
            onClick={() => router.back()}
            className={styles.back}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className={styles.crumbCopy}>
            <span className={styles.eyebrow}>Employee portal</span>
            <span className={styles.crumbTitle}>Profile overview</span>
          </div>
        </div>
          <div className={styles.topActions}>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className={styles.outlineAction}
                aria-label="Edit employee"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit profile</span>
              </button>
            ) : null}
            <Link
              href={`/employees/${id}/leaves`}
              className={styles.primaryAction}
              aria-label="View leave calendar"
            >
              <CalendarDays className="h-4 w-4" />
              <span>Leave calendar</span>
            </Link>
          </div>
      </header>

      <div className={styles.wrap}>
        {tab === "overview" ? (
          <ProfileHeader
            employee={employee}
            summary={attendanceSummary}
            annualRemaining={annualRemaining}
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
          <Link href={`/employees/${id}/requests`} className={styles.tab}>
            <FileText className="h-4 w-4" />
            Requests
          </Link>
        </nav>

        <div className={styles.content}>
          {tab === "overview" ? (
            <OverviewSection
              employee={employee}
              summary={attendanceSummary}
              loading={loading}
            />
          ) : null}
          {tab === "attendance" ? (
            <AttendanceSection
              employee={employee}
              summary={attendanceSummary}
              mosqueAttendance={mosqueAttendance}
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
              netIncome={currentSlip?.netIncome ?? null}
              periodTitle={currentSlip?.periodTitle ?? null}
              slipLoading={slipPending}
              slipError={slipError}
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
          <Link href={`/employees/${id}/requests`} className={styles.mobileTab}>
            <FileText />
            <span>Requests</span>
          </Link>
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

function DetailsSkeleton() {
  return (
    <div className={styles.page}>
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
      <div className={styles.wrap}>
        <div className={styles.topbar}>
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className={styles.profileHeader}>
          <div className={styles.hero}>
            <div className={styles.heroMain}>
              <div className="space-y-3">
                <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-white ring-1 ring-slate-200" />
            </div>
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

function ProfileHeader({
  employee,
  summary,
  annualRemaining,
}: {
  employee: EmployeeDetailsView;
  summary: AttendanceSummary;
  annualRemaining: number;
}) {
  return (
    <section className={styles.profileHeader} aria-label="Employee profile">
      <div className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroText}>
            <p className={cn(styles.eyebrow, styles.heroKicker)}>Employee profile</p>
            <h1 className={styles.name}>{employee.name}</h1>
            <p className={styles.designation}>
              <BriefcaseBusiness className="h-4 w-4 shrink-0" />
              {employee.designation || "No designation"}
            </p>
            {employee.section ? (
              <div className={styles.heroMeta}>
                <span className={styles.heroBadge}>
                  <Building2 /> {employee.section}
                </span>
              </div>
            ) : null}
          </div>
          <div className={styles.avatar} aria-hidden="true">
            {employee.name.trim().charAt(0).toUpperCase() || "?"}
          </div>
        </div>
      </div>

      <div className={styles.stats}>
        <MiniStat
          icon={CheckCircle2}
          value={`${summary.presentDays}/7`}
          label="Present this week"
        />
        <MiniStat
          icon={TimerOff}
          value={String(summary.lateMinutes)}
          label="Late minutes"
        />
        <MiniStat
          icon={CalendarDays}
          value={String(summary.leaveDaysThisMonth)}
          label="Leaves this month"
        />
        <MiniStat
          icon={WalletCards}
          value={String(annualRemaining)}
          label="Annual days left"
        />
      </div>
    </section>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className={styles.stat}>
      <div className={styles.statIcon}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className={styles.statLabel}>{label}</p>
        <p className={styles.statValue}>{value}</p>
      </div>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function OverviewSection({
  employee,
  summary,
  loading,
}: {
  employee: EmployeeDetailsView;
  summary: AttendanceSummary;
  loading: boolean;
}) {
  return (
    <div className={styles.overviewGrid}>
      <Panel icon={IdCard} title="Identity">
        <div className={styles.identityList}>
          <IdentityRow
            icon={IdCard}
            label="Record card"
            value={employee.recordCardNumber}
          />
          <IdentityRow
            icon={ShieldCheck}
            label="Device ID"
            value={employee.deviceUserId}
          />
          <IdentityRow
            icon={CalendarCheck}
            label="Joined"
            value={
              employee.joinedDate ? formatDateLabel(employee.joinedDate) : ""
            }
          />
          <IdentityRow
            icon={MapPin}
            label="Address"
            value={employee.address}
          />
        </div>
      </Panel>

      <Panel icon={Clock3} title="This week at a glance">
        {loading ? (
          <div className={styles.weekDays}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className={styles.weekDay}>
                <span className="h-2.5 w-3 animate-pulse rounded bg-slate-100" />
                <div className={cn(styles.weekCell, "animate-pulse")} />
              </div>
            ))}
          </div>
        ) : (
        <div className={styles.weekDays}>
          {summary.weekDays.map((day) => {
            const dayNum = day.label.split(" ")[1] ?? day.label;
            return (
              <div
                key={day.date}
                className={styles.weekDay}
              >
                <span className={styles.weekDayName}>
                  {day.day.charAt(0)}
                </span>
                <div
                  className={styles.weekCell}
                  data-status={day.status}
                  title={`${day.day} ${day.label}: ${day.status}`}
                >
                  {dayNum}
                  <span className={styles.weekDot} />
                </div>
              </div>
            );
          })}
        </div>
        )}

        <div className={styles.legend}>
          {(
            [
              ["present", "Present"],
              ["late", "Late"],
              ["leave", "Leave"],
              ["absent", "Absent"],
            ] as const
          ).map(([status, label]) => (
            <span key={status} className={styles.legendItem}>
              <span className={styles.legendDot} data-status={status} />
              <span>{label}</span>
            </span>
          ))}
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
  loading,
}: {
  employee: EmployeeDetailsView;
  summary: AttendanceSummary;
  mosqueAttendance: MosqueAttendanceDoc[];
  loading: boolean;
}) {
  const balanceByKey = useMemo(
    () => new Map(employee.leaveBalances.map((b) => [b.key, b])),
    [employee.leaveBalances],
  );

  return (
    <div className={styles.stack}>
      <Panel icon={Clock3} title="This week's attendance">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <div className={styles.attendanceList}>
            {summary.weekDays.map((day) => {
              const StatusIcon = statusMeta[day.status].icon;
              const leaveBalance = day.leaveType
                ? balanceByKey.get(day.leaveType)
                : undefined;
              return (
                <div
                  key={day.date}
                  className={styles.attendanceItem}
                >
                  <div
                    className={styles.attendanceDate}
                    data-status={day.status}
                  >
                    <small>
                      {day.day}
                    </small>
                    <strong>
                      {day.label.split(" ")[1] ?? day.label}
                    </strong>
                  </div>

                  <div className={styles.attendanceBody}>
                    <div className={styles.attendanceNote}>
                      <StatusIcon className="h-4 w-4 shrink-0" />
                      <p className="truncate">
                        {day.note}
                      </p>
                    </div>
                    <p className={styles.attendanceSource}>
                      {leaveBalance
                        ? leaveBalance.allowance !== null
                          ? `${leaveBalance.used} of ${leaveBalance.allowance} used this year`
                          : `${leaveBalance.used} taken this year`
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
                    <span className={styles.attendanceBadge}>
                      +{day.lateMinutes}m
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

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

/* ---------------- Leave ---------------- */

function LeaveSection({
  employee,
  employeeId,
}: {
  employee: EmployeeDetailsView;
  employeeId: string;
}) {
  return (
    <div className={styles.stack}>
      <Link href={`/employees/${employeeId}/leaves`} className={styles.featureLink}>
        <span className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5" />
          <span>
            <strong>Leave calendar</strong>
            <small>View all recorded leave days</small>
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </Link>

      <Panel icon={WalletCards} title="Leave balances">
        <div className={styles.leaveGrid}>
          {employee.leaveBalances.map((leave, index) => (
            <LeaveBloom key={leave.key} leave={leave} index={index} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Pay ---------------- */

const payDotColors = [
  "bg-teal-500",
  "bg-orange-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-amber-500",
];

function PaySection({
  employee,
  employeeId,
  netIncome,
  periodTitle,
  slipLoading,
  slipError,
}: {
  employee: EmployeeDetailsView;
  employeeId: string;
  netIncome: number | null;
  periodTitle: string | null;
  slipLoading: boolean;
  slipError: boolean;
}) {
  const hasData =
    employee.payItems.length > 0 || employee.creditSchemes.length > 0;

  return (
    <Panel icon={Banknote} title="Pay & allowances">
      <div className={styles.stack}>
        {/* Net pay + salary slips */}
        <div className={styles.payHero}>
          <p className={styles.eyebrow}>
            Net pay{periodTitle ? ` ┬À ${periodTitle}` : " ┬À this month"}
          </p>
          {slipLoading ? (
            <div className="mt-2 h-9 w-40 animate-pulse rounded-lg bg-slate-200" />
          ) : netIncome !== null ? (
            <p className={styles.payAmount}>
              MVR {formatMvr(netIncome)}
            </p>
          ) : slipError ? (
            <p className={styles.payAmount}>
              Couldn&apos;t load this month&apos;s slip
            </p>
          ) : (
            <p className={styles.payAmount}>
              No slip for this month
            </p>
          )}
          <Link
            href={`/employees/${employeeId}/salary-slips`}
            className={styles.payLink}
          >
            <FileText className="h-4 w-4" />
            View salary slips
          </Link>
        </div>

        {hasData ? (
          <>
            {/* Breakdown */}
            {employee.payItems.length > 0 ? (
              <div className={styles.panel}>
                <h3 className={styles.panelTitle}>Pay breakdown</h3>
                <div className="mt-3">
                  {employee.payItems.map((item, index) => (
                    <div
                      key={item.label}
                      className={styles.payRow}
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          payDotColors[index % payDotColors.length],
                        )}
                      />
                      <p className="min-w-0 flex-1 truncate">
                        {item.label}
                      </p>
                      <p className="shrink-0 font-bold">
                        {formatMoney(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Credit schemes */}
            {employee.creditSchemes.length > 0 ? (
              <div className={styles.stack}>
                <h3 className={styles.panelTitle}>
                  Credit schemes
                </h3>
                {employee.creditSchemes.map((scheme, index) => (
                  <div
                    key={`${scheme.name}-${index}`}
                    className={styles.payScheme}
                  >
                    <div className={styles.paySchemeHeader}>
                      <p className="text-sm font-black text-slate-900">
                        {scheme.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                        Scheme
                      </span>
                    </div>
                    <p className={styles.paySchemeDate}>
                      {formatDateLabel(scheme.startDate)} ÔåÆ{" "}
                      {formatDateLabel(scheme.endDate)}
                    </p>
                    <div className={styles.paySchemeAmounts}>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                          Start
                        </p>
                        <p className="text-sm font-black tabular-nums text-slate-900">
                          {formatMoney(scheme.startMonthAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                          End
                        </p>
                        <p className="text-sm font-black tabular-nums text-slate-900">
                          {formatMoney(scheme.endMonthAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">
            No pay fields are set for this employee.
          </p>
        )}
      </div>
    </Panel>
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
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const empty = !value;
  return (
    <div className={styles.identityRow}>
      <div className={styles.identityIcon}>
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
      </p>
    </div>
  );
}

const leaveAccents = ["#3e7654", "#bb7547", "#557ba2", "#806591", "#8b8c40"];

function LeaveBloom({
  leave,
  index,
}: {
  leave: LeaveBalanceView;
  index: number;
}) {
  const limited = leave.allowance !== null;
  const percent =
    limited && leave.allowance
      ? Math.min(100, Math.round((leave.used / leave.allowance) * 100))
      : 0;
  const accent = leaveAccents[index % leaveAccents.length];

  return (
    <div className={styles.leaveCard} style={{ "--leave-color": accent } as React.CSSProperties}>
      <div className={styles.leaveName}>
        <span className={styles.leaveColor} />
        <p>
          {leave.label}
        </p>
      </div>

      <div className={styles.leaveCount}>
          <strong>
            {limited ? leave.remaining : leave.used}
          </strong>
          <span>
            {limited
              ? "days left"
              : isAdditiveLeave(leave.key)
                ? "recorded"
                : "days"}
          </span>
      </div>

      {limited ? (
        <>
          <div className={styles.leaveProgress}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.leaveUsed}>{leave.used} of {leave.allowance} used</p>
        </>
      ) : null}
    </div>
  );
}
