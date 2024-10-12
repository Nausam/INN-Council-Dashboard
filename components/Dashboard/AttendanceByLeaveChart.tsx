import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface AttendanceByLeaveProps {
  data: { leaveType: string; count: number }[];
}

const AttendanceByLeaveChart: React.FC<AttendanceByLeaveProps> = ({ data }) => {
  const chartData = {
    labels: data.map((item) => item.leaveType),
    datasets: [
      {
        label: "Leave Types",
        data: data.map((item) => item.count),
        backgroundColor: ["#36a2eb", "#ff6384", "#ffcd56", "#4bc0c0"],
      },
    ],
  };

  return (
    <div className="flex justify-center">
      <Pie data={chartData} width={300} height={300} />
    </div>
  );
};

export default AttendanceByLeaveChart;
