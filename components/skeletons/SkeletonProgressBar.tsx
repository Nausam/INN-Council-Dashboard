import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SkeletonProgressBar: React.FC = () => (
  <div className="mb-6">
    <div className="flex justify-between mb-2">
      <div className="h-6 w-24 bg-gray-300 rounded-md"></div>{" "}
      {/* Matches text size */}
      <div className="h-6 w-16 bg-gray-300 rounded-md"></div>{" "}
      {/* Matches percentage */}
    </div>
    <div className="relative h-8 rounded-full bg-gray-200 shadow-inner">
      <div className="absolute top-0 left-0 h-full w-0 bg-gray-300 rounded-full"></div>
    </div>
  </div>
);

const SkeletonProgressSection: React.FC = () => {
  return (
    <Card
      style={{
        background: "linear-gradient(to bottom right, #fdfdfd, #f8f8f8)",
      }}
      className="w-full mx-auto mt-8 shadow-lg rounded-md border-none p-6"
    >
      <CardHeader>
        <div className="h-8 w-48 bg-gray-300 rounded mb-4"></div>{" "}
        {/* Matches title size */}
      </CardHeader>
      <CardContent className="space-y-6">
        <SkeletonProgressBar />
        <SkeletonProgressBar />
        <SkeletonProgressBar />
      </CardContent>
    </Card>
  );
};

export default SkeletonProgressSection;
