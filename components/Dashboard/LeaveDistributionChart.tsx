// components/Dashboard/LeaveDistributionChart.tsx
"use client";

import { useCouncilAttendanceMonthQuery } from "@/hooks/queries";
import type { ChartData, ChartOptions } from "chart.js";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import React, { useMemo } from "react";
import { Pie } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  Title,
  CategoryScale,
  LinearScale,
);

type LeaveKey =
  | "sickLeave"
  | "annualLeave"
  | "certificateSickLeave"
  | "familyRelatedLeave"
  | "maternityLeave"
  | "paternityLeave"
  | "noPayLeave"
  | "officialLeave";

interface AttendanceRecord {
  $id: string;
  date: string;
  leaveType: LeaveKey | null;
}

const LEAVE_KEYS: LeaveKey[] = [
  "sickLeave",
  "annualLeave",
  "certificateSickLeave",
  "familyRelatedLeave",
  "maternityLeave",
  "paternityLeave",
  "noPayLeave",
  "officialLeave",
];

const LEAVE_LABELS: string[] = [
  "Sick Leave",
  "Annual Leave",
  "Certificate Leave",
  "Family Related Leave",
  "Maternity Leave",
  "Paternity Leave",
  "No Pay Leave",
  "Official Leave",
];

const COLORS: string[] = [
  "#4BC0C0",
  "#FF6384",
  "#FFCE56",
  "#36A2EB",
  "#FF9F40",
  "#9966FF",
  "#C9CBCF",
  "#6A4C93",
];

interface LeaveDistributionProps {
  month: string;
}

const LeaveDistributionChart: React.FC<LeaveDistributionProps> = ({
  month,
}) => {
  const { data: attendanceRecords = [], isLoading, isError } =
    useCouncilAttendanceMonthQuery(month);

  const chartData = useMemo<ChartData<"pie", number[], string> | null>(() => {
    if (isError) return null;

    const records = attendanceRecords as AttendanceRecord[];
    const counts: Record<LeaveKey, number> = {
      sickLeave: 0,
      annualLeave: 0,
      certificateSickLeave: 0,
      familyRelatedLeave: 0,
      maternityLeave: 0,
      paternityLeave: 0,
      noPayLeave: 0,
      officialLeave: 0,
    };

    for (const rec of records) {
      if (rec.leaveType && counts[rec.leaveType] !== undefined) {
        counts[rec.leaveType] += 1;
      }
    }

    return {
      labels: LEAVE_LABELS,
      datasets: [
        {
          label: "Leave Distribution",
          data: LEAVE_KEYS.map((k) => counts[k]),
          backgroundColor: COLORS,
          hoverOffset: 4,
        },
      ],
    };
  }, [attendanceRecords, isError]);

  const options: ChartOptions<"pie"> = {
    responsive: true,
    plugins: {
      legend: { position: "bottom" },
      title: { display: false, text: "" },
      tooltip: { enabled: true },
    },
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <h3 className="text-2xl font-bold text-center mb-4">
        Leave Distribution for {month}
      </h3>
      {isLoading ? (
        <p>Loading...</p>
      ) : chartData ? (
        <Pie data={chartData} options={options} />
      ) : (
        <p>No data available for the selected month.</p>
      )}
    </div>
  );
};

export default LeaveDistributionChart;
