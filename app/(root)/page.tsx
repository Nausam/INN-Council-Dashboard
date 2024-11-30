"use client";

import React, { useState, useEffect } from "react";
import { FaUsers, FaClock, FaTimes, FaRunning } from "react-icons/fa";
import DashboardCard from "@/components/Dashboard/DashboardCard";
import ProgressSection from "@/components/Dashboard/Progressbar";
import DashboardHeader from "@/components/Dashboard/DashboardHeader.tsx";
import {
  fetchAttendanceForDate,
  fetchAllEmployees,
} from "@/lib/appwrite/appwrite";
import EmployeeListCard from "@/components/Dashboard/EmployeeListCard";
import SkeletonListCard from "@/components/skeletons/SkeletonListCard";
import SkeletonDashboardCard from "@/components/skeletons/SkeletonDashboardCard";
import SkeletonProgressSection from "@/components/skeletons/SkeletonProgressBar";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import LeaveDistributionChart from "@/components/Dashboard/LeaveDistributionChart";
import { signOutUser } from "@/lib/actions/user.actions";

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

  // Fetch data from the backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const employees = await fetchAllEmployees();
        const attendanceRecords = await fetchAttendanceForDate(
          formattedSelectedDate
        );

        const totalEmployees = employees.length;
        let onTimeCount = 0;
        let lateCount = 0;
        let absentCount = 0;

        const absentees: string[] = [];
        const latecomers: string[] = [];

        attendanceRecords.forEach((record) => {
          if (record.leaveType) {
            absentCount++;
            absentees.push(record.employeeId.name);
          } else {
            if (record.minutesLate > 0) {
              lateCount++;
              latecomers.push(record.employeeId.name);
            } else {
              onTimeCount++;
            }
          }
        });

        setDashboardData({
          totalEmployees,
          onTime: onTimeCount,
          late: lateCount,
          absent: absentCount,
        });
        setAbsentEmployees(absentees);
        setLateEmployees(latecomers);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  const { totalEmployees, onTime, late, absent } = dashboardData;
  const onTimePercent = Math.round((onTime / totalEmployees) * 100);
  const latePercent = Math.round((late / totalEmployees) * 100);
  const absentPercent = Math.round((absent / totalEmployees) * 100);

  const logout = () => {};

  return (
    <div className="container mx-auto p-8">
      <button
        className="border-2 px-16 py-4 m-2 hover:cursor-pointer"
        type="submit"
        onClick={async () => await signOutUser()}
      >
        LOGOUT
      </button>
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
            title="Total Employees"
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

      <div className="mt-10">
        {/* <h2 className="text-2xl font-bold mb-4">Attendance Overview</h2> */}
        <div className="flex flex-col md:flex-row w-full items-center justify-between mx-auto gap-10">
          {loading ? (
            <SkeletonProgressSection />
          ) : (
            <ProgressSection
              onTimePercent={onTimePercent}
              latePercent={latePercent}
              absentPercent={absentPercent}
            />
          )}

          <div className="flex flex-col gap-4 w-full items-center justify-center">
            {/* Absent Employees */}
            {loading ? (
              <SkeletonListCard />
            ) : (
              <EmployeeListCard
                title="On Leave"
                employees={absentEmployees}
                bgColor="#EB5757"
                emptyMessage="No employees are absent today."
                gradient="linear-gradient(to right, #ddbea8,  #fad4c0)"
              />
            )}
            {/* Late Employees */}
            {loading ? (
              <SkeletonListCard />
            ) : (
              <EmployeeListCard
                title="Late Employees"
                employees={lateEmployees}
                bgColor="#fa6e28"
                emptyMessage="No employees are late today."
                gradient="linear-gradient(to right, #ddbea8,  #fad4c0)"
              />
            )}
          </div>
        </div>
      </div>

      {/* <div className="max-w-7xl mx-auto p-8 mt-10">
        <div className="mb-6">
         
          <input
            type="month"
            id="month-picker"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border p-2 rounded-md"
          />
        </div>

        <LeaveDistributionChart month={selectedMonth} />
      </div> */}
    </div>
  );
};

export default Dashboard;
