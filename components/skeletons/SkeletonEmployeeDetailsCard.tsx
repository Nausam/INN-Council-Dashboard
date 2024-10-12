import React from "react";

const SkeletonEmployeeDetailsCard = () => {
  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden p-6 max-w-md mx-auto mt-16 border animate-pulse">
      <div className="text-center">
        <div className="h-6 bg-gray-300 rounded w-3/4 mx-auto mb-4"></div>
        <div className="h-4 bg-gray-300 rounded w-1/2 mx-auto"></div>
      </div>

      <div className="mt-6 border-t pt-4 flex justify-between items-center">
        <div className="h-5 bg-gray-300 rounded w-1/3"></div>
        <div className="h-5 bg-gray-300 rounded w-1/3"></div>
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="h-5 bg-gray-300 rounded w-1/3 mb-4"></div>
        <ul className="mt-2">
          {[...Array(7)].map((_, index) => (
            <li
              key={index}
              className={`flex justify-between ${
                index % 2 === 0 ? "bg-gray-100" : ""
              } p-2`}
            >
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              <div className="h-7 bg-gray-300 rounded-full w-7"></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SkeletonEmployeeDetailsCard;
