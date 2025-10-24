import React from "react";

const SkeletonReportsTable = () => {
  return (
    <div className="rounded-md border">
      <div className="w-full animate-pulse">
        <div className="border-gray-300 bg-gray-200 h-16"></div>
        {[...Array(5)].map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-16 gap-2">
            {[...Array(7)].map((_, colIndex) => (
              <div
                key={colIndex}
                className={`p-3 bg-gray-200 rounded-sm h-16 w-full ${
                  colIndex === 0 ? "text-center" : ""
                }`}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonReportsTable;
