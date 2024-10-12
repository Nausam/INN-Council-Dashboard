import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface LateEmployeeData {
  name: string;
  minutesLate: number;
}

interface TopLateEmployeesProps {
  employees: { name: string; minutesLate: number }[];
}

const TopLateEmployees: React.FC<TopLateEmployeesProps> = ({ employees }) => {
  // Prepare chart data
  const chartData = {
    labels: employees.map((employee) => employee.name),
    datasets: [
      {
        label: "Minutes Late",
        data: employees.map((employee) => employee.minutesLate),
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
    ],
  };

  // Configure the chart options, including the y-axis to display minutes
  const options = {
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (tickValue: string | number) {
            return `${tickValue} min`; // Show minutes
          },
          stepSize: 5, // Define the interval for ticks (e.g., 5 minutes)
        },
        title: {
          display: true,
          text: "Minutes Late",
        },
      },
      x: {
        title: {
          display: true,
          text: "Employee",
        },
      },
    },
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Top Late Employees</h2>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default TopLateEmployees;
