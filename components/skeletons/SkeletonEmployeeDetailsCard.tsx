"use client";

import React from "react";

const EmployeeDetailsCardSkeleton = () => {
  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl shadow-lg p-8 w-full max-w-4xl mx-auto animate-pulse">
      {/* Header Section Skeleton */}
      <div className="flex items-center gap-8 pb-6 border-b border-gray-200">
        <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
        <div className="flex-1">
          <div className="h-6 bg-gray-200 rounded-md w-3/4 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded-md w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded-md w-1/3"></div>
        </div>
      </div>

      {/* Leave Details Skeleton */}
      <div className="mt-8">
        <div className="h-6 bg-gray-200 rounded-md w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-4 rounded-lg bg-gray-200 shadow-md"
            >
              <div className="h-4 bg-gray-300 rounded-md w-3/4 mb-2"></div>
              <div className="h-6 bg-gray-300 rounded-md w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsCardSkeleton;
