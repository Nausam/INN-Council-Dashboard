import React from "react";

const DashboardHeader: React.FC = () => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={{
        background: "linear-gradient(to right, #028090, #00a896, #07beb8)",
      }}
      className=" text-white px-6 py-8 lg:py-12 rounded-md shadow-md mb-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold">Welcome to Your Dashboard!</h1>
          <p>{currentDate}</p>
        </div>
        <p className="text-2xl font-bold lg:mt-0 mt-5">Innamaadhoo Council</p>
      </div>
    </div>
  );
};

export default DashboardHeader;
