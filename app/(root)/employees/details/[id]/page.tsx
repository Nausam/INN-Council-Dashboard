"use client";

import { EmployeeEditModal } from "@/components/Modals/EmployeeEditModal";
import {
  AvatarGlow,
  EmptyState,
  PageShell,
  SectionBadge,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { useUser } from "@/Providers/UserProvider";
import {
  useCouncilAttendanceMonthQuery,
  useEmployeeLeaveCalendarQuery,
  useEmployeeQuery,
  useGeneratedSlipForEmployeeQuery,
  useMosqueDailyAttendanceMonthQuery,
} from "@/hooks/queries";
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
import type { MosqueAttendanceDoc } from "@/lib/firebase/types";
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

type TabId = "overview" | "attendance" | "leave" | "pay";

const tabs: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "attendance", label: "Attend", icon: Clock3 },
  { id: "leave", label: "Leave", icon: WalletCards },
  { id: "pay", label: "Pay", icon: Banknote },
];

const dayStyles: Record<
  WeekDayAttendance["status"],
  {
    chip: string;
    dot: string;
    ring: string;
    surface: string;
    solid: string;
    accent: string;
  }
> = {
  present: {
    chip: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    ring: "ring-emerald-100",
    surface: "bg-emerald-50/60 ring-emerald-100",
    solid: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white",
    accent: "text-emerald-700",
  },
  late: {
    chip: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    ring: "ring-amber-100",
    surface: "bg-amber-50/60 ring-amber-100",
    solid: "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
    accent: "text-amber-700",
  },
  leave: {
    chip: "bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
    ring: "ring-sky-100",
    surface: "bg-sky-50/60 ring-sky-100",
    solid: "bg-gradient-to-br from-sky-500 to-blue-500 text-white",
    accent: "text-sky-700",
  },
  absent: {
    chip: "bg-slate-100 text-slate-500",
    dot: "bg-slate-300",
    ring: "ring-slate-100",
    surface: "bg-slate-50 ring-slate-100",
    solid: "bg-slate-200 text-slate-500",
    accent: "text-slate-500",
  },
};

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

export default function EmployeeDetailsDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useUser();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const currentMonth = monthKey();

  const { data, isPending, isError } = useEmployeeQuery(id);
  const { data: leaves = [], isPending: leavesPending } =
    useEmployeeLeaveCalendarQuery(id);
  const { data: councilAttendance = [], isPending: councilPending } =
    useCouncilAttendanceMonthQuery(currentMonth);
  const { data: mosqueAttendance = [], isPending: mosquePending } =
    useMosqueDailyAttendanceMonthQuery(currentMonth, id ?? "");
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
      <PageShell className="bg-[#fbfcf8]">
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
    <div className="min-h-screen bg-[#f4f6f4] pb-28 lg:pb-12">
      {/* Hide the app's mobile header on this page only */}
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>

      {/* Top bar (desktop only) */}
      <header className="sticky top-0 z-30 hidden border-b border-slate-200/70 bg-[#f4f6f4]/85 backdrop-blur lg:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 transition active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition active:scale-95"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </button>
            ) : null}
            <Link
              href={`/employees/${id}/leaves`}
              className="flex h-10 items-center gap-1.5 rounded-full bg-teal-600 px-4 text-sm font-bold text-white shadow-sm shadow-teal-600/25 transition active:scale-95"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4">
        {/* Persistent profile header */}
        <ProfileHeader
          employee={employee}
          summary={attendanceSummary}
          annualRemaining={annualRemaining}
        />

        {/* Desktop section tabs */}
        <div className="mt-6 hidden gap-2 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-slate-100 lg:inline-flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition",
                tab === t.id
                  ? "bg-teal-600 text-white shadow-sm shadow-teal-600/25"
                  : "text-slate-500 hover:bg-slate-50 hover:text-teal-700",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5">
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
      </main>

      {/* Mobile bottom navbar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="flex flex-col items-center gap-1 rounded-2xl px-1 py-2 transition"
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex h-9 w-12 items-center justify-center rounded-full transition",
                    active
                      ? "bg-teal-600 text-white shadow-sm shadow-teal-600/30"
                      : "text-slate-400",
                  )}
                >
                  <t.icon className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    "text-[11px] font-black",
                    active ? "text-teal-700" : "text-slate-400",
                  )}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
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
    <div className="min-h-screen bg-[#f4f6f4] px-4 pb-28 pt-6 lg:pb-12">
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />

        {/* Hero */}
        <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-100">
          <div className="bg-gradient-to-br from-teal-600/70 to-emerald-500/70 px-6 pb-12 pt-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 animate-pulse rounded-[24px] bg-white/30" />
              <div className="space-y-2.5">
                <div className="h-6 w-44 animate-pulse rounded-lg bg-white/30" />
                <div className="h-4 w-28 animate-pulse rounded bg-white/25" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-white/20" />
              </div>
            </div>
          </div>
          <div className="-mt-8 grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
              />
            ))}
          </div>
        </div>

        {/* Panel */}
        <div className="space-y-3 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
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
    <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-100">
      <div className="bg-gradient-to-br from-teal-600 to-emerald-500 px-6 pb-12 pt-6 text-white">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
          <AvatarGlow
            name={employee.name}
            size="lg"
            className="h-20 w-20 rounded-[24px] text-3xl ring-4 ring-white/30"
          />
          <div className="mt-3 min-w-0 sm:mt-0">
            <h1 className="text-2xl font-black leading-tight tracking-tight">
              {employee.name}
            </h1>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-sm font-bold text-white/90 sm:justify-start">
              <BriefcaseBusiness className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {employee.designation || "No designation"}
              </span>
            </div>
            {employee.section ? (
              <div className="mt-3 flex justify-center sm:justify-start">
                <SectionBadge
                  section={employee.section}
                  icon={Building2}
                  className="rounded-full bg-white/20 ring-white/20"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Floating stat row */}
      <div className="-mt-8 grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
        <MiniStat
          icon={CheckCircle2}
          tone="text-emerald-600 bg-emerald-50"
          value={`${summary.presentDays}/7`}
          label="Week"
        />
        <MiniStat
          icon={TimerOff}
          tone="text-amber-600 bg-amber-50"
          value={String(summary.lateMinutes)}
          label="Late min"
        />
        <MiniStat
          icon={CalendarDays}
          tone="text-sky-600 bg-sky-50"
          value={String(summary.leaveDaysThisMonth)}
          label="Leaves"
        />
        <MiniStat
          icon={WalletCards}
          tone="text-violet-600 bg-violet-50"
          value={String(annualRemaining)}
          label="Annual"
        />
      </div>
    </section>
  );
}

function MiniStat({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-100">
      <div
        className={cn(
          "mx-auto flex h-8 w-8 items-center justify-center rounded-xl",
          tone,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-xl font-black tabular-nums text-slate-900">
        {value}
      </p>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
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
    <>
      <Panel icon={IdCard} title="Identity">
        <div className="divide-y divide-slate-100">
          <IdentityRow
            icon={IdCard}
            tone="bg-teal-50 text-teal-700"
            label="Record card"
            value={employee.recordCardNumber}
          />
          <IdentityRow
            icon={ShieldCheck}
            tone="bg-indigo-50 text-indigo-700"
            label="Device ID"
            value={employee.deviceUserId}
          />
          <IdentityRow
            icon={CalendarCheck}
            tone="bg-amber-50 text-amber-700"
            label="Joined"
            value={
              employee.joinedDate ? formatDateLabel(employee.joinedDate) : ""
            }
          />
          <IdentityRow
            icon={MapPin}
            tone="bg-rose-50 text-rose-700"
            label="Address"
            value={employee.address}
          />
        </div>
      </Panel>

      <Panel icon={Clock3} title="This week at a glance">
        {loading ? (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="h-2.5 w-3 animate-pulse rounded bg-slate-100" />
                <div className="aspect-square w-full max-w-[44px] animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {summary.weekDays.map((day) => {
            const s = dayStyles[day.status];
            const dayNum = day.label.split(" ")[1] ?? day.label;
            return (
              <div
                key={day.date}
                className="flex flex-col items-center gap-1.5"
              >
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  {day.day.charAt(0)}
                </span>
                <div
                  className={cn(
                    "flex aspect-square w-full max-w-[44px] flex-col items-center justify-center rounded-2xl text-sm font-black tabular-nums",
                    s.chip,
                  )}
                >
                  {dayNum}
                  <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", s.dot)} />
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {(
            [
              ["present", "Present"],
              ["late", "Late"],
              ["leave", "Leave"],
              ["absent", "Absent"],
            ] as const
          ).map(([status, label]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  dayStyles[status].dot,
                )}
              />
              <span className="text-[11px] font-bold text-slate-400">
                {label}
              </span>
            </span>
          ))}
        </div>
      </Panel>
    </>
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
    <>
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
          <div className="space-y-2.5">
            {summary.weekDays.map((day) => {
              const s = dayStyles[day.status];
              const StatusIcon = statusMeta[day.status].icon;
              const leaveBalance = day.leaveType
                ? balanceByKey.get(day.leaveType)
                : undefined;
              return (
                <div
                  key={day.date}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl p-2.5 ring-1",
                    s.surface,
                  )}
                >
                  {/* date block — colored hero tile */}
                  <div
                    className={cn(
                      "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl shadow-sm",
                      s.solid,
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wide opacity-80">
                      {day.day}
                    </span>
                    <span className="text-xl font-black tabular-nums leading-none">
                      {day.label.split(" ")[1] ?? day.label}
                    </span>
                  </div>

                  {/* body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={cn("h-4 w-4 shrink-0", s.accent)} />
                      <p className="truncate text-sm font-black text-slate-900">
                        {day.note}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                      {leaveBalance
                        ? leaveBalance.allowance !== null
                          ? `${leaveBalance.used} of ${leaveBalance.allowance} used this year`
                          : `${leaveBalance.used} taken this year`
                        : day.source}
                    </p>
                  </div>

                  {leaveBalance ? (
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black tabular-nums text-sky-700 shadow-sm ring-1 ring-sky-100">
                      {leaveBalance.allowance !== null
                        ? `${leaveBalance.used}/${leaveBalance.allowance}`
                        : `${leaveBalance.used}`}
                    </span>
                  ) : day.lateMinutes > 0 ? (
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-amber-700 shadow-sm ring-1 ring-amber-100">
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
          <div className="space-y-3">
            {mosqueAttendance.slice(0, 6).map((row) => (
              <div key={row.$id} className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-sky-600">
                  {formatDateLabel(row.date)}
                </p>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {mosquePrayerFields.map(([label, field]) => (
                    <div
                      key={field}
                      className="rounded-xl bg-white p-1.5 text-center"
                    >
                      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                        {label}
                      </p>
                      <p className="mt-0.5 text-[11px] font-black text-slate-800">
                        {formatPrayerTime(row[field])}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </>
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
    <>
      <Link
        href={`/employees/${employeeId}/leaves`}
        className="flex items-center justify-between gap-3 rounded-[28px] bg-teal-600 p-5 text-white shadow-sm shadow-teal-600/25 transition active:scale-[0.98] lg:hidden"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
            <CalendarDays className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-black">Leave calendar</span>
            <span className="block text-xs font-bold text-white/80">
              View & manage all leave days
            </span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5" />
      </Link>

      <Panel icon={WalletCards} title="Leave balances">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {employee.leaveBalances.map((leave, index) => (
            <LeaveBloom key={leave.key} leave={leave} index={index} />
          ))}
        </div>
      </Panel>
    </>
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
      <div className="space-y-4">
        {/* Net pay + salary slips */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 p-5 text-white">
          <p className="text-[11px] font-black uppercase tracking-wide text-white/80">
            Net pay{periodTitle ? ` · ${periodTitle}` : " · this month"}
          </p>
          {slipLoading ? (
            <div className="mt-2 h-9 w-40 animate-pulse rounded-lg bg-white/25" />
          ) : netIncome !== null ? (
            <p className="mt-1 text-3xl font-black tabular-nums">
              MVR {formatMvr(netIncome)}
            </p>
          ) : slipError ? (
            <p className="mt-1 text-lg font-black text-white/90">
              Couldn&apos;t load this month&apos;s slip
            </p>
          ) : (
            <p className="mt-1 text-lg font-black text-white/90">
              No slip for this month
            </p>
          )}
          <Link
            href={`/employees/${employeeId}/salary-slips`}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-black text-white ring-1 ring-white/25 transition active:scale-[0.98] hover:bg-white/25"
          >
            <FileText className="h-4 w-4" />
            View salary slips
          </Link>
        </div>

        {hasData ? (
          <>
            {/* Breakdown */}
            {employee.payItems.length > 0 ? (
              <div className="rounded-2xl bg-slate-50 p-2">
                <div className="divide-y divide-slate-200/70">
                  {employee.payItems.map((item, index) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 px-2 py-2.5"
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          payDotColors[index % payDotColors.length],
                        )}
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-600">
                        {item.label}
                      </p>
                      <p className="shrink-0 text-sm font-black tabular-nums text-slate-900">
                        {formatMoney(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Credit schemes */}
            {employee.creditSchemes.length > 0 ? (
              <div className="space-y-2">
                <p className="px-1 text-xs font-black uppercase tracking-wide text-slate-400">
                  Credit schemes
                </p>
                {employee.creditSchemes.map((scheme, index) => (
                  <div
                    key={`${scheme.name}-${index}`}
                    className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-900">
                        {scheme.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                        Scheme
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {formatDateLabel(scheme.startDate)} →{" "}
                      {formatDateLabel(scheme.endDate)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                          Start
                        </p>
                        <p className="text-sm font-black tabular-nums text-slate-900">
                          {formatMoney(scheme.startMonthAmount)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2.5">
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
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-black tracking-tight text-slate-900">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function IdentityRow({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
}) {
  const empty = !value;
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          tone,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p
        className={cn(
          "ml-auto truncate pl-3 text-right text-sm font-black",
          empty ? "text-slate-300" : "text-slate-900",
        )}
      >
        {empty ? "Not set" : value}
      </p>
    </div>
  );
}

const leaveAccents = [
  { dot: "bg-teal-500", bar: "bg-teal-500", text: "text-teal-600", soft: "bg-teal-50" },
  { dot: "bg-orange-500", bar: "bg-orange-500", text: "text-orange-600", soft: "bg-orange-50" },
  { dot: "bg-blue-500", bar: "bg-blue-500", text: "text-blue-600", soft: "bg-blue-50" },
  { dot: "bg-violet-500", bar: "bg-violet-500", text: "text-violet-600", soft: "bg-violet-50" },
  { dot: "bg-emerald-500", bar: "bg-emerald-500", text: "text-emerald-600", soft: "bg-emerald-50" },
];

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
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", accent.dot)} />
        <p className="truncate text-sm font-black text-slate-900">
          {leave.label}
        </p>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="leading-none">
          <span className={cn("text-3xl font-black tabular-nums", accent.text)}>
            {limited ? leave.remaining : leave.used}
          </span>
          <span className="ml-1 text-xs font-bold text-slate-400">
            {limited
              ? "days left"
              : isAdditiveLeave(leave.key)
                ? "recorded"
                : "days"}
          </span>
        </p>
        {limited ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums",
              accent.soft,
              accent.text,
            )}
          >
            {leave.used}/{leave.allowance}
          </span>
        ) : null}
      </div>

      {limited ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all", accent.bar)}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
