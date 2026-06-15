"use client";

import ProgressSection from "@/components/Dashboard/Progressbar";
import DashboardHeader from "@/components/Dashboard/DashboardHeader.tsx";
import EmployeeListCard from "@/components/Dashboard/EmployeeListCard";
import StatCard from "@/components/Dashboard/StatCard";
import { PageShell } from "@/components/design-system";
import SkeletonDashboardCard from "@/components/skeletons/SkeletonDashboardCard";
import SkeletonListCard from "@/components/skeletons/SkeletonListCard";
import SkeletonProgressSection from "@/components/skeletons/SkeletonProgressBar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  computeCouncilMinutesLate,
  resolveSectionForLateness,
} from "@/lib/attendance/council-lateness";
import { useDashboardQuery } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  Timer,
  UserMinus,
  Users,
} from "lucide-react";
import React, { useMemo, useState } from "react";

/* ===================== Minimal types + guards ===================== */

type EmployeeDoc = {
  $id?: string;
  id?: string;
  name?: string;
  section?: string;
  designation?: string;
};

type EmployeeRef =
  | string
  | {
      $id?: string;
      name?: string;
    };

type OfficeAttendanceDoc = {
  employeeId?: EmployeeRef;
  employeeName?: string;
  leaveType?: string | null;
  minutesLate?: number | null;
  signInTime?: string | null;
};

type MosqueAttendanceDoc = {
  employeeId?: EmployeeRef;
  employeeName?: string;
  fathisMinutesLate?: number | null;
  mendhuruMinutesLate?: number | null;
  asuruMinutesLate?: number | null;
  maqribMinutesLate?: number | null;
  ishaMinutesLate?: number | null;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isEmployeeDoc(v: unknown): v is EmployeeDoc {
  return (
    isObject(v) &&
    (typeof v.$id === "string" || typeof v.$id === "undefined") &&
    (typeof v.id === "string" || typeof v.id === "undefined") &&
    (typeof v.name === "string" || typeof v.name === "undefined")
  );
}
function isOfficeAttendanceDoc(v: unknown): v is OfficeAttendanceDoc {
  return isObject(v) && "employeeId" in v;
}
function isMosqueAttendanceDoc(v: unknown): v is MosqueAttendanceDoc {
  return isObject(v) && "employeeId" in v;
}

/* ===================== Component ===================== */

interface DashboardProps {
  totalEmployees: number;
  onTime: number;
  late: number;
  absent: number;
}

const emptyDashboard: DashboardProps = {
  totalEmployees: 0,
  onTime: 0,
  late: 0,
  absent: 0,
};

const Dashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const formattedSelectedDate = selectedDate
    ? new Date(
        selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .split("T")[0]
    : "";

  const { data, isPending } = useDashboardQuery(formattedSelectedDate);

  const { dashboardData, absentEmployees, lateEmployees, hasAttendance } =
    useMemo(() => {
      const empty = {
        dashboardData: emptyDashboard,
        absentEmployees: [] as Array<{ name: string; leaveType?: string | null }>,
        lateEmployees: [] as Array<{
          name: string;
          designation?: string;
          minutesLate: number;
        }>,
        hasAttendance: false,
      };

      if (!data) return empty;

      const { employees: employeesRaw, officeAttendance: officeRaw, mosqueAttendance: mosqueRaw } =
        data;

      const employees: EmployeeDoc[] = Array.isArray(employeesRaw)
        ? employeesRaw.filter(isEmployeeDoc)
        : [];
      const totalEmployees = employees.length;

      const idToEmployee = new Map<
        string,
        { name: string; section?: string; designation?: string }
      >();
      for (const e of employees) {
        const id = e.$id ?? e.id;
        if (id) {
          idToEmployee.set(String(id), {
            name: String(e.name ?? "Unknown"),
            section: e.section,
            designation: e.designation,
          });
        }
      }

      const resolveEmployeeId = (
        rec: OfficeAttendanceDoc | MosqueAttendanceDoc,
      ) => {
        const ref = rec.employeeId;
        if (!ref) return "";
        if (typeof ref === "string") return ref;
        return typeof ref.$id === "string" ? ref.$id : "";
      };

      const resolveName = (
        rec: OfficeAttendanceDoc | MosqueAttendanceDoc,
      ) => {
        if (typeof rec.employeeName === "string" && rec.employeeName.trim())
          return rec.employeeName;
        const employeeId = resolveEmployeeId(rec);
        if (employeeId && idToEmployee.has(employeeId)) {
          return idToEmployee.get(employeeId)!.name;
        }
        const ref = rec.employeeId;
        if (typeof ref === "string") return ref;
        const objName = ref?.name;
        if (typeof objName === "string" && objName.trim()) return objName;
        return "Unknown";
      };

      const officeAttendance: OfficeAttendanceDoc[] = Array.isArray(officeRaw)
        ? officeRaw.filter(isOfficeAttendanceDoc)
        : [];
      const mosqueAttendance: MosqueAttendanceDoc[] = Array.isArray(mosqueRaw)
        ? mosqueRaw.filter(isMosqueAttendanceDoc)
        : [];

      const anyAttendance =
        (officeAttendance?.length ?? 0) > 0 ||
        (mosqueAttendance?.length ?? 0) > 0;

      if (!anyAttendance) {
        return {
          dashboardData: {
            totalEmployees,
            onTime: 0,
            late: 0,
            absent: 0,
          },
          absentEmployees: [],
          lateEmployees: [],
          hasAttendance: false,
        };
      }

      const absentSet = new Set<string>();
      const absentees: Array<{ name: string; leaveType?: string | null }> =
        [];
      for (const rec of officeAttendance) {
        if (rec.leaveType) {
          const nm = resolveName(rec);
          if (!absentSet.has(nm)) {
            absentSet.add(nm);
            absentees.push({
              name: nm,
              leaveType: rec.leaveType,
            });
          }
        }
      }

      const lateMap = new Map<
        string,
        { name: string; designation?: string; minutesLate: number }
      >();

      for (const rec of officeAttendance) {
        const nm = resolveName(rec);
        const employeeId = resolveEmployeeId(rec);
        const employee = employeeId
          ? idToEmployee.get(employeeId)
          : undefined;

        let mins = 0;
        if (rec.signInTime && formattedSelectedDate) {
          mins = computeCouncilMinutesLate(
            rec.signInTime,
            formattedSelectedDate,
            resolveSectionForLateness(
              employee?.section,
              employee?.designation,
            ),
          );
        } else if (typeof rec.minutesLate === "number") {
          mins = rec.minutesLate;
        }

        if (!absentSet.has(nm) && mins > 0) {
          lateMap.set(nm, {
            name: nm,
            designation: employee?.designation,
            minutesLate: mins,
          });
        }
      }

      for (const rec of mosqueAttendance) {
        const nm = resolveName(rec);
        const f =
          typeof rec.fathisMinutesLate === "number"
            ? rec.fathisMinutesLate
            : 0;
        const m =
          typeof rec.mendhuruMinutesLate === "number"
            ? rec.mendhuruMinutesLate
            : 0;
        const a =
          typeof rec.asuruMinutesLate === "number" ? rec.asuruMinutesLate : 0;
        const q =
          typeof rec.maqribMinutesLate === "number"
            ? rec.maqribMinutesLate
            : 0;
        const i =
          typeof rec.ishaMinutesLate === "number" ? rec.ishaMinutesLate : 0;
        const anyLate = f > 0 || m > 0 || a > 0 || q > 0 || i > 0;
        if (!absentSet.has(nm) && anyLate) {
          lateMap.set(nm, {
            name: nm,
            designation: idToEmployee.get(resolveEmployeeId(rec))?.designation,
            minutesLate: Math.max(f, m, a, q, i),
          });
        }
      }

      const lateList = Array.from(lateMap.values()).sort((a, b) =>
        b.minutesLate - a.minutesLate,
      );
      const absentCount = absentSet.size;
      const lateCount = lateList.length;

      const onTimeCount = Math.max(
        0,
        totalEmployees - absentCount - lateCount,
      );

      return {
        dashboardData: {
          totalEmployees,
          onTime: onTimeCount,
          late: lateCount,
          absent: absentCount,
        },
        absentEmployees: absentees,
        lateEmployees: lateList,
        hasAttendance: true,
      };
    }, [data, formattedSelectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setIsPopoverOpen(false);
  };

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  const { totalEmployees, onTime, late, absent } = dashboardData;

  const dateLabel = selectedDate
    ? format(selectedDate, "EEEE, MMMM d, yyyy")
    : "Select a date";

  return (
    <PageShell>
      <div className="mb-6 flex items-center justify-end">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="council-outline"
              className={cn(
                "h-11 rounded-xl px-4",
                !selectedDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-teal-600" />
              {selectedDate ? (
                <span className="font-semibold text-slate-700">
                  {format(selectedDate, "PPP")}
                </span>
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-xl p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <DashboardHeader dateLabel={dateLabel} />

      {!isPending && !hasAttendance ? (
        <div className="mb-8 flex items-start gap-4 rounded-3xl border border-amber-200/80 bg-amber-50/80 p-5 ring-1 ring-amber-100">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-amber-950">No attendance records</h3>
            <p className="mt-1 text-sm font-medium text-amber-800/80">
              No attendance has been created for the selected date.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          <>
            <SkeletonDashboardCard />
            <SkeletonDashboardCard />
            <SkeletonDashboardCard />
            <SkeletonDashboardCard />
          </>
        ) : (
          <>
            <StatCard
              icon={Users}
              label="Total Employees"
              value={totalEmployees}
              tone="teal"
            />
            <StatCard
              icon={Clock}
              label="On Time"
              value={onTime}
              percentage={pct(onTime, totalEmployees)}
              tone="emerald"
            />
            <StatCard
              icon={Timer}
              label="Late"
              value={late}
              percentage={pct(late, totalEmployees)}
              tone="amber"
            />
            <StatCard
              icon={UserMinus}
              label="On Leave"
              value={absent}
              percentage={pct(absent, totalEmployees)}
              tone="rose"
            />
          </>
        )}
      </div>

      <div className="mt-10 w-full">
        {isPending ? (
          <SkeletonProgressSection />
        ) : (
          <ProgressSection
            onTimePercent={pct(onTime, totalEmployees)}
            latePercent={pct(late, totalEmployees)}
            absentPercent={pct(absent, totalEmployees)}
          />
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {isPending ? (
            <>
              <SkeletonListCard />
              <SkeletonListCard />
            </>
          ) : (
            <>
              <EmployeeListCard
                title="On Leave"
                employees={absentEmployees}
                tone="rose"
                emptyMessage="No employees are on leave today."
                variant="leave"
              />
              <EmployeeListCard
                title="Late Employees"
                employees={lateEmployees}
                tone="amber"
                emptyMessage="No employees are late today."
                variant="late"
              />
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default Dashboard;
