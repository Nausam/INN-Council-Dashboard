import React from "react";

const SkeletonDashboardCard: React.FC = () => (
  <div className="p-6 shadow-lg rounded-md text-white animate-pulse border">
    <div className="flex justify-between items-center">
      <div className="h-10 w-10 bg-gray-300 rounded-full"></div>
      <div className="h-6 w-32 bg-gray-300 rounded-md"></div>
    </div>
    <div className="mt-2 h-8 w-8 bg-gray-300 rounded-full"></div>
  </div>
);

export default SkeletonDashboardCard;
