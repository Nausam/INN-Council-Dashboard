import React from "react";

const DashboardHeader: React.FC = () => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-cyan-600 text-white p-6 rounded-md shadow-md mb-4">
      <h1 className="text-2xl font-bold">Welcome to Your Dashboard!</h1>
      <p>{currentDate}</p>
    </div>
  );
};

export default DashboardHeader;
