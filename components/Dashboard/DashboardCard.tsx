import React from "react";

interface DashboardCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  gradient: string; // Pass the gradient as a prop
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  icon,
  title,
  value,
  gradient,
}) => (
  <div
    className={`p-6 shadow-xl rounded-lg text-white`}
    style={{
      background: `${gradient}`,
      boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.1)",
    }}
  >
    <div className="flex justify-between items-center">
      <div className="text-3xl">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
    <p className="text-3xl font-bold mt-2">{value}</p>
  </div>
);

export default DashboardCard;
