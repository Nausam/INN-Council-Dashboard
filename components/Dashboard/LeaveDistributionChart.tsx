// components/Dashboard/LeaveDistributionChart.tsx
import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  CategoryScale,
  LinearScale,
} from "chart.js";
import { fetchAttendanceForMonth } from "@/lib/appwrite"; // Adjust the path based on your app structure

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  Title,
  CategoryScale,
  LinearScale
);

interface LeaveDistributionProps {
  month: string;
}

const LeaveDistributionChart: React.FC<LeaveDistributionProps> = ({
  month,
}) => {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const getLeaveDistribution = async () => {
      setLoading(true);
      try {
        const attendanceRecords = await fetchAttendanceForMonth(month); // Fetch the data for the given month

        // Count the different leave types
        const leaveTypeCounts: { [key: string]: number } = {
          sickLeave: 0,
          annualLeave: 0,
          certificateSickLeave: 0,
          familyRelatedLeave: 0,
          maternityLeave: 0,
          paternityLeave: 0,
          noPayLeave: 0,
          officialLeave: 0,
        };

        attendanceRecords.forEach((record) => {
          if (
            record.leaveType &&
            leaveTypeCounts[record.leaveType] !== undefined
          ) {
            leaveTypeCounts[record.leaveType] += 1;
          }
        });

        // Prepare data for the Pie Chart
        const data = {
          labels: [
            "Sick Leave",
            "Annual Leave",
            "Certificate Leave",
            "Family Related Leave",
            "Maternity Leave",
            "Paternity Leave",
            "No Pay Leave",
            "Official Leave",
          ],
          datasets: [
            {
              label: "Leave Distribution",
              data: Object.values(leaveTypeCounts),
              backgroundColor: [
                "#4BC0C0",
                "#FF6384",
                "#FFCE56",
                "#36A2EB",
                "#FF9F40",
                "#9966FF",
                "#C9CBCF",
                "#6A4C93",
              ],
              hoverOffset: 4,
            },
          ],
        };

        setChartData(data);
      } catch (error) {
        console.error("Error fetching leave data:", error);
      } finally {
        setLoading(false);
      }
    };

    getLeaveDistribution();
  }, [month]);

  return (
    <div className="w-full max-w-lg mx-auto">
      <h3 className="text-2xl font-bold text-center mb-4">
        Leave Distribution for {month}
      </h3>
      {loading ? (
        <p>Loading...</p>
      ) : chartData ? (
        <Pie data={chartData} options={{ responsive: true }} />
      ) : (
        <p>No data available for the selected month.</p>
      )}
    </div>
  );
};

export default LeaveDistributionChart;
