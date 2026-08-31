"use client";

import ProgressSection from "@/components/Dashboard/Progressbar";
import DashboardHeader from "@/components/Dashboard/DashboardHeader.tsx";
import EmployeeListCard from "@/components/Dashboard/EmployeeListCard";
import StatCard from "@/components/Dashboard/StatCard";
import { PageShell } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DashboardSummary } from "@/lib/dashboard/summary";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  Timer,
  UserMinus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardPageView({
  date,
  data,
}: {
  date: string;
  data: DashboardSummary;
}) {
  const router = useRouter();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const selectedDate = parseISO(date);

  const handleDateSelect = (next: Date | undefined) => {
    if (!next) return;
    const iso = new Date(next.getTime() - next.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
    setIsPopoverOpen(false);
    router.push(iso === date ? "/" : `/?date=${iso}`);
  };

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const { totalEmployees, onTime, late, absent, hasAttendance } = data;

  return (
    <PageShell>
      <div className="mb-6 flex items-center justify-end">
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="council-outline" className="h-11 rounded-xl px-4">
              <CalendarIcon className="mr-2 h-4 w-4 text-teal-600" />
              <span className="font-semibold text-slate-700">
                {format(selectedDate, "PPP")}
              </span>
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

      <DashboardHeader dateLabel={format(selectedDate, "EEEE, MMMM d, yyyy")} />

      {!hasAttendance ? (
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
      </div>

      <div className="mt-10 w-full">
        <ProgressSection
          onTimePercent={pct(onTime, totalEmployees)}
          latePercent={pct(late, totalEmployees)}
          absentPercent={pct(absent, totalEmployees)}
        />

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <EmployeeListCard
            title="On Leave"
            employees={data.absentEmployees}
            tone="rose"
            emptyMessage="No employees are on leave today."
            variant="leave"
          />
          <EmployeeListCard
            title="Late Employees"
            employees={data.lateEmployees}
            tone="amber"
            emptyMessage="No employees are late today."
            variant="late"
          />
        </div>
      </div>
    </PageShell>
  );
}
