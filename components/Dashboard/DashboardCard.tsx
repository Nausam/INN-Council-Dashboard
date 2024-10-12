import React from "react";
import { IconType } from "react-icons";

interface DashboardCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  bgColor: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  icon,
  title,
  value,
  bgColor,
}) => (
  <div className={`p-4 shadow-lg rounded-md text-white ${bgColor}`}>
    <div className="flex justify-between items-center">
      <div className="text-3xl">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
    <p className="text-2xl font-bold mt-2">{value}</p>
  </div>
);

export default DashboardCard;
