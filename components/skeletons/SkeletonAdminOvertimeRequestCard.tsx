"use client";

const SkeletonAdminOvertimeRequestCard = () => {
  return (
    <div className="rounded-lg shadow-lg border-2 border-gray-200 bg-gray-100 p-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-12 w-2/4 bg-gray-300 rounded" />
        <div className="h-10 w-24 bg-gray-300 rounded" />
      </div>
      <div className="mt-6">
        <div className="h-7 w-full bg-gray-300 rounded" />
      </div>
      <div className="mt-6 flex justify-between gap-4">
        <div className="h-10 w-1/4 bg-gray-300 rounded" />
        <div className="h-10 w-1/4 bg-gray-300 rounded" />
        <div className="h-10 w-1/6 bg-gray-300 rounded" />
      </div>
      <div className="mt-4 h-20 w-full bg-gray-300 rounded" />
      <div className="flex mt-6 justify-end">
        <div className="h-6 w-52 bg-gray-300 rounded" />
      </div>
    </div>
  );
};

export default SkeletonAdminOvertimeRequestCard;
