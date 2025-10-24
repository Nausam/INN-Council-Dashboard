"use client";

import React from "react";

const SkeletonLeaveRequestCard: React.FC = () => {
  return (
    <div className="rounded-xl shadow-lg border bg-gray-100 p-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-9 bg-gray-200 rounded w-24"></div>
      </div>
      <div className="mt-4">
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
      <div className="mt-6 flex flex-col gap-4 text-sm">
        <div className="flex justify-between">
          <div className="h-12 bg-gray-200 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 rounded w-1/3"></div>
        </div>
        <div className="h-6 bg-gray-200 rounded w-1/4"></div>
      </div>
    </div>
  );
};

export default SkeletonLeaveRequestCard;
