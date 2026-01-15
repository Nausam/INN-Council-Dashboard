"use client";

import DashboardCard from "@/components/Dashboard/DashboardCard";
import EmployeeListCard from "@/components/Dashboard/EmployeeListCard";
import ProgressSection from "@/components/Dashboard/Progressbar";
import SkeletonDashboardCard from "@/components/skeletons/SkeletonDashboardCard";
import SkeletonListCard from "@/components/skeletons/SkeletonListCard";
import SkeletonProgressSection from "@/components/skeletons/SkeletonProgressBar";
import {
  fetchAllEmployees,
  fetchAttendanceForDate,
  fetchMosqueAttendanceForDate,
} from "@/lib/appwrite/appwrite";
import React, { useEffect, useState } from "react";
import { FaClock, FaRunning, FaTimes, FaUsers } from "react-icons/fa";

import DashboardHeader from "@/components/Dashboard/DashboardHeader.tsx";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import StatCard from "@/components/Dashboard/StatCard";

/* ===================== Minimal types + guards ===================== */

type EmployeeDoc = { $id?: string; id?: string; name?: string };

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

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardProps>({
    totalEmployees: 0,
    onTime: 0,
    late: 0,
    absent: 0,
  });
  const [absentEmployees, setAbsentEmployees] = useState<
    Array<{ name: string; leaveType?: string | null }>
  >([]);
  const [lateEmployees, setLateEmployees] = useState<Array<{ name: string }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [hasAttendance, setHasAttendance] = useState<boolean>(false);

  const formattedSelectedDate = selectedDate
    ? new Date(
        selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000
      )
        .toISOString()
        .split("T")[0]
    : "";

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setIsPopoverOpen(false);
  };

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [employeesRaw, officeRaw, mosqueRaw] = await Promise.all([
          fetchAllEmployees(),
          fetchAttendanceForDate(formattedSelectedDate),
          fetchMosqueAttendanceForDate(formattedSelectedDate),
        ]);

        // Employees
        const employees: EmployeeDoc[] = Array.isArray(employeesRaw)
          ? employeesRaw.filter(isEmployeeDoc)
          : [];
        const totalEmployees = employees.length;

        // id -> name map
        const idToName = new Map<string, string>();
        for (const e of employees) {
          const id = e.$id ?? e.id;
          if (id) idToName.set(String(id), String(e.name ?? "Unknown"));
        }

        const resolveName = (
          rec: OfficeAttendanceDoc | MosqueAttendanceDoc
        ) => {
          if (typeof rec.employeeName === "string" && rec.employeeName.trim())
            return rec.employeeName;
          const ref = rec.employeeId;
          if (!ref) return "Unknown";
          if (typeof ref === "string") return idToName.get(ref) ?? ref;
          const objName = ref.name;
          if (typeof objName === "string" && objName.trim()) return objName;
          const objId = ref.$id;
          if (typeof objId === "string") return idToName.get(objId) ?? objId;
          return "Unknown";
        };

        const officeAttendance: OfficeAttendanceDoc[] = Array.isArray(officeRaw)
          ? officeRaw.filter(isOfficeAttendanceDoc)
          : [];
        const mosqueAttendance: MosqueAttendanceDoc[] = Array.isArray(mosqueRaw)
          ? mosqueRaw.filter(isMosqueAttendanceDoc)
          : [];

        // Any attendance created for this date?
        const anyAttendance =
          (officeAttendance?.length ?? 0) > 0 ||
          (mosqueAttendance?.length ?? 0) > 0;

        if (!anyAttendance) {
          // Keep the employee count, but force all metrics to 0
          setHasAttendance(false);
          setDashboardData({
            totalEmployees,
            onTime: 0,
            late: 0,
            absent: 0,
          });
          setAbsentEmployees([]);
          setLateEmployees([]);
          return;
        }

        setHasAttendance(true);

        // ---------- ABSENT (office) ----------
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

        // ---------- LATE (office OR mosque) ----------
        const lateSet = new Set<string>();

        for (const rec of officeAttendance) {
          const nm = resolveName(rec);
          const mins =
            typeof rec.minutesLate === "number" ? rec.minutesLate : 0;
          if (!absentSet.has(nm) && mins > 0) lateSet.add(nm);
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
          if (!absentSet.has(nm) && anyLate) lateSet.add(nm);
        }

        const lateList = Array.from(lateSet).map((name) => ({ name }));
        const absentCount = absentSet.size;
        const lateCount = lateSet.size;

        // IMPORTANT: onTime is not inferred when there's attendance—still compute normally.
        const onTimeCount = Math.max(
          0,
          totalEmployees - absentCount - lateCount
        );

        setDashboardData({
          totalEmployees,
          onTime: onTimeCount,
          late: lateCount,
          absent: absentCount,
        });
        setAbsentEmployees(absentees);
        setLateEmployees(lateList);
      } catch (error) {
        console.error("Error fetching data:", error);
        setHasAttendance(false);
        setDashboardData({ totalEmployees: 0, onTime: 0, late: 0, absent: 0 });
        setAbsentEmployees([]);
        setLateEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    if (formattedSelectedDate) fetchData();
  }, [formattedSelectedDate]);

  const { totalEmployees, onTime, late, absent } = dashboardData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="container mx-auto px-4 py-8 lg:px-8">
        {/* Date picker */}
        <div className="mb-8 flex items-center justify-between">
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "group h-11 rounded-xl border-slate-200 bg-white px-4 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-slate-500 transition-colors group-hover:text-indigo-500" />
                {selectedDate ? (
                  <span className="font-medium text-slate-700">
                    {format(selectedDate, "PPP")}
                  </span>
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <DashboardHeader />

        {/* No attendance notice */}
        {!loading && !hasAttendance ? (
          <div className="group relative mb-8 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-sm transition-all hover:shadow-md">
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-amber-200/30 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <svg
                  className="h-5 w-5 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-amber-900">
                  No attendance records
                </h3>
                <p className="mt-1 text-sm text-amber-700">
                  No attendance has been created for the selected date.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Stats cards - NOW USING StatCard COMPONENT */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {loading ? (
            <>
              <SkeletonDashboardCard />
              <SkeletonDashboardCard />
              <SkeletonDashboardCard />
              <SkeletonDashboardCard />
            </>
          ) : (
            <>
              <StatCard
                icon={FaUsers}
                label="Total Employees"
                value={totalEmployees}
                colorScheme="indigo"
              />

              <StatCard
                icon={FaClock}
                label="On Time"
                value={onTime}
                percentage={pct(onTime, totalEmployees)}
                colorScheme="emerald"
              />

              <StatCard
                icon={FaRunning}
                label="Late"
                value={late}
                percentage={pct(late, totalEmployees)}
                colorScheme="amber"
              />

              <StatCard
                icon={FaTimes}
                label="On Leave"
                value={absent}
                percentage={pct(absent, totalEmployees)}
                colorScheme="rose"
              />
            </>
          )}
        </div>

        {/* Progress section */}
        <div className="mt-12 w-full">
          <div className="flex w-full flex-col items-center justify-between gap-10">
            {loading ? (
              <SkeletonProgressSection />
            ) : (
              <ProgressSection
                onTimePercent={pct(onTime, totalEmployees)}
                latePercent={pct(late, totalEmployees)}
                absentPercent={pct(absent, totalEmployees)}
              />
            )}
          </div>

          {/* Employee lists */}
          <div className="mt-12 flex w-full flex-col gap-6 lg:flex-row lg:gap-8">
            {loading ? (
              <>
                <SkeletonListCard />
                <SkeletonListCard />
              </>
            ) : (
              <>
                <EmployeeListCard
                  title="On Leave"
                  employees={absentEmployees}
                  bgColor="#f43f5e"
                  emptyMessage="No employees are on leave today."
                  gradient="linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)"
                />
                <EmployeeListCard
                  title="Late Employees"
                  employees={lateEmployees}
                  bgColor="#f59e0b"
                  emptyMessage="No employees are late today."
                  gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
