"use client";

import React, { useState, useEffect } from "react";
import { FaUsers, FaClock, FaTimes, FaRunning } from "react-icons/fa";
import DashboardCard from "@/components/Dashboard/DashboardCard";
import ProgressSection from "@/components/Dashboard/Progressbar";
import DashboardHeader from "@/components/Dashboard/DashboardHeader.tsx";
import { fetchAttendanceForDate, fetchAllEmployees } from "@/lib/appwrite";
import EmployeeListCard from "@/components/Dashboard/EmployeeListCard";
import SkeletonListCard from "@/components/skeletons/SkeletonListCard";
import SkeletonDashboardCard from "@/components/skeletons/SkeletonDashboardCard";
import SkeletonProgressSection from "@/components/skeletons/SkeletonProgressBar";

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

  const todayDate = new Date().toISOString().split("T")[0];

  // Fetch data from the backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const employees = await fetchAllEmployees();
        const attendanceRecords = await fetchAttendanceForDate(todayDate);

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
  }, [todayDate]);

  const { totalEmployees, onTime, late, absent } = dashboardData;
  const onTimePercent = Math.round((onTime / totalEmployees) * 100);
  const latePercent = Math.round((late / totalEmployees) * 100);
  const absentPercent = Math.round((absent / totalEmployees) * 100);

  return (
    <div className="container mx-auto p-8">
      <DashboardHeader />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <SkeletonDashboardCard />
        ) : (
          <DashboardCard
            icon={<FaUsers />}
            title="Total Employees"
            value={totalEmployees}
            bgColor="bg-blue-600"
          />
        )}

        {loading ? (
          <SkeletonDashboardCard />
        ) : (
          <DashboardCard
            icon={<FaClock />}
            title="On Time"
            value={onTime}
            bgColor="bg-green-600"
          />
        )}

        {loading ? (
          <SkeletonDashboardCard />
        ) : (
          <DashboardCard
            icon={<FaRunning />}
            title="Late"
            value={late}
            bgColor="bg-yellow-500"
          />
        )}

        {loading ? (
          <SkeletonDashboardCard />
        ) : (
          <DashboardCard
            icon={<FaTimes />}
            title="Absent"
            value={absent}
            bgColor="bg-red-500"
          />
        )}
      </div>

      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-4">Attendance Overview</h2>
        <div className="flex w-full items-center justify-between mx-auto gap-10">
          {loading ? (
            <SkeletonProgressSection />
          ) : (
            <ProgressSection
              onTimePercent={onTimePercent}
              latePercent={latePercent}
              absentPercent={absentPercent}
            />
          )}

          <div className="w-full items-center justify-center">
            {/* Absent Employees */}
            {loading ? (
              <SkeletonListCard />
            ) : (
              <EmployeeListCard
                title="Absent Employees"
                employees={absentEmployees}
                bgColor="bg-red-500"
                emptyMessage="No employees are absent today."
              />
            )}

            {/* Late Employees */}
            {loading ? (
              <SkeletonListCard />
            ) : (
              <EmployeeListCard
                title="Late Employees"
                employees={lateEmployees}
                bgColor="bg-yellow-500"
                emptyMessage="No employees are late today."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
