"use client";

import DashboardCard from "@/components/Dashboard/DashboardCard";
import DashboardHeader from "@/components/Dashboard/DashboardHeader.tsx";
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
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
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
        const [employees, officeAttendance, mosqueAttendance] =
          await Promise.all([
            fetchAllEmployees(),
            fetchAttendanceForDate(formattedSelectedDate),
            fetchMosqueAttendanceForDate(formattedSelectedDate),
          ]);

        const totalEmployees = employees.length;

        // Build an id -> name map (supports $id or id)
        const idToName = new Map<string, string>();
        for (const e of employees as any[]) {
          const id = e.$id ?? e.id;
          if (id) idToName.set(String(id), String(e.name ?? "Unknown"));
        }

        // Helper to always return a human name
        const resolveName = (rec: any) => {
          // prefer already-denormalized name
          if (rec?.employeeName) return String(rec.employeeName);

          // relation object with name
          if (rec?.employeeId && typeof rec.employeeId === "object") {
            if (rec.employeeId.name) return String(rec.employeeId.name);
            if (rec.employeeId.$id && idToName.has(rec.employeeId.$id)) {
              return idToName.get(rec.employeeId.$id)!;
            }
          }

          // plain string id
          const maybeId = String(rec?.employeeId ?? "");
          if (maybeId && idToName.has(maybeId)) {
            return idToName.get(maybeId)!;
          }

          // last fallback
          return maybeId || "Unknown";
        };

        // ---------- ABSENT (office) ----------
        const absentSet = new Set<string>();
        const absentees: string[] = [];
        for (const rec of officeAttendance as any[]) {
          if (rec?.leaveType) {
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
        for (const rec of officeAttendance as any[]) {
          const nm = resolveName(rec);
          const mins = Number(rec?.minutesLate ?? 0);
          if (!absentSet.has(nm) && mins > 0) {
            lateSet.add(nm);
          }
        }

        // Mosque: any prayer minutesLate > 0
        for (const rec of mosqueAttendance as any[]) {
          const nm = resolveName(rec);
          const f = Number(rec?.fathisMinutesLate ?? 0);
          const m = Number(rec?.mendhuruMinutesLate ?? 0);
          const a = Number(rec?.asuruMinutesLate ?? 0);
          const q = Number(rec?.maqribMinutesLate ?? 0);
          const i = Number(rec?.ishaMinutesLate ?? 0);
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

    fetchData();
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
              onSelect={(date) => {
                setSelectedDate(date);
                setIsPopoverOpen(false);
              }}
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
