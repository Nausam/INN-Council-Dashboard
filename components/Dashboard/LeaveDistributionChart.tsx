// components/Dashboard/LeaveDistributionChart.tsx
"use client";

import { fetchAttendanceForMonth } from "@/lib/appwrite/appwrite";
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
import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  Title,
  CategoryScale,
  LinearScale
);

/* ---------------- Types ---------------- */

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
  // ... other fields you may have
  leaveType: LeaveKey | null;
}

/* Keep labels aligned with the internal keys by index */
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
  /** Month in "YYYY-MM" */
  month: string;
}

const LeaveDistributionChart: React.FC<LeaveDistributionProps> = ({
  month,
}) => {
  const [chartData, setChartData] = useState<ChartData<
    "pie",
    number[],
    string
  > | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const getLeaveDistribution = async () => {
      setLoading(true);
      try {
        const attendanceRecords = (await fetchAttendanceForMonth(
          month
        )) as AttendanceRecord[];

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

        for (const rec of attendanceRecords) {
          if (rec.leaveType && counts[rec.leaveType] !== undefined) {
            counts[rec.leaveType] += 1;
          }
        }

        const data: ChartData<"pie", number[], string> = {
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

        setChartData(data);
      } catch (err) {
        console.error("Error fetching leave data:", err);
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };

    getLeaveDistribution();
  }, [month]);

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
      {loading ? (
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
