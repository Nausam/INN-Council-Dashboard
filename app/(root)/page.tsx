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

/* ===================== Minimal types + guards ===================== */

type EmployeeDoc = {
  $id?: string;
  id?: string;
  name?: string;
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
  const [absentEmployees, setAbsentEmployees] = useState<string[]>([]);
  const [lateEmployees, setLateEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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

        // Pull everything we need
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

        // Build an id -> name map (supports $id or id)
        const idToName = new Map<string, string>();
        for (const e of employees) {
          const id = e.$id ?? e.id;
          if (id) idToName.set(String(id), String(e.name ?? "Unknown"));
        }

        // Helper to always return a human name
        const resolveName = (
          rec: OfficeAttendanceDoc | MosqueAttendanceDoc
        ) => {
          // prefer already-denormalized name
          if (typeof rec.employeeName === "string" && rec.employeeName.trim()) {
            return rec.employeeName;
          }

          const ref = rec.employeeId;

          if (!ref) return "Unknown";

          if (typeof ref === "string") {
            return idToName.get(ref) ?? ref;
          }

          const objName = ref.name;
          if (typeof objName === "string" && objName.trim()) return objName;

          const objId = ref.$id;
          if (typeof objId === "string") {
            return idToName.get(objId) ?? objId;
          }

          return "Unknown";
        };

        // Office attendance
        const officeAttendance: OfficeAttendanceDoc[] = Array.isArray(officeRaw)
          ? officeRaw.filter(isOfficeAttendanceDoc)
          : [];

        // Mosque attendance
        const mosqueAttendance: MosqueAttendanceDoc[] = Array.isArray(mosqueRaw)
          ? mosqueRaw.filter(isMosqueAttendanceDoc)
          : [];

        // ---------- ABSENT (office) ----------
        const absentSet = new Set<string>();
        const absentees: string[] = [];
        for (const rec of officeAttendance) {
          if (rec.leaveType) {
            const nm = resolveName(rec);
            if (!absentSet.has(nm)) {
              absentSet.add(nm);
              absentees.push(nm);
            }
          }
        }

        // ---------- LATE (office OR mosque) ----------
        const lateSet = new Set<string>();

        // Office: minutesLate > 0
        for (const rec of officeAttendance) {
          const nm = resolveName(rec);
          const mins =
            typeof rec.minutesLate === "number" ? rec.minutesLate : 0;
          if (!absentSet.has(nm) && mins > 0) {
            lateSet.add(nm);
          }
        }

        // Mosque: any prayer minutesLate > 0
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
            lateSet.add(nm);
          }
        }

        const lateList = Array.from(lateSet);

        const absentCount = absentSet.size;
        const lateCount = lateSet.size;
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
      } finally {
        setLoading(false);
      }
    };

    if (formattedSelectedDate) {
      fetchData();
    }
  }, [formattedSelectedDate]);

  const { totalEmployees, onTime, late, absent } = dashboardData;

  return (
    <div className="container mx-auto p-8">
      <div className="mb-4">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "border p-2 rounded-md w-48 h-12",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? (
                format(selectedDate, "PPP")
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <SkeletonDashboardCard />
        ) : (
          <DashboardCard
            icon={<FaUsers />}
            title="Employees"
            value={totalEmployees}
            gradient="linear-gradient(135deg, #6DD5FA, #2980B9)"
          />
        )}

        {loading ? (
          <SkeletonDashboardCard />
        ) : (
          <DashboardCard
            icon={<FaClock />}
            title="On Time"
            value={onTime}
            gradient="linear-gradient(135deg, #A8E063, #56AB2F)"
          />
        )}

        {loading ? (
          <SkeletonDashboardCard />
        ) : (
          <DashboardCard
            icon={<FaRunning />}
            title="Late"
            value={late}
            gradient="linear-gradient(135deg, #F2C94C,  #F2994A)"
          />
        )}

        {loading ? (
          <SkeletonDashboardCard />
        ) : (
          <DashboardCard
            icon={<FaTimes />}
            title="On Leave"
            value={absent}
            gradient="linear-gradient(135deg, #F2994A, #EB5757)"
          />
        )}
      </div>

      <div className="mt-5 w-full">
        <div className="flex flex-col w-full items-center justify-between mx-auto gap-10">
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

        <div className="flex flex-col lg:flex-row gap-4 w-full mt-10">
          {loading ? (
            <SkeletonListCard />
          ) : (
            <EmployeeListCard
              title="On Leave"
              employees={absentEmployees}
              bgColor="#EB5757"
              emptyMessage="No employees are absent today."
              gradient="linear-gradient(to right, #fa6e28,  #fa6e28)"
            />
          )}

          {loading ? (
            <SkeletonListCard />
          ) : (
            <EmployeeListCard
              title="Late Employees"
              employees={lateEmployees}
              bgColor="#fa6e28"
              emptyMessage="No employees are late today."
              gradient="linear-gradient(to right, #EB5757,  #EB5757)"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
