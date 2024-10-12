import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SkeletonProgressBar: React.FC = () => (
  <div className="mb-6">
    <div className="flex justify-between mb-2">
      <div className="h-4 w-20 bg-gray-300 rounded"></div>
      <div className="h-4 w-10 bg-gray-300 rounded"></div>
    </div>
    <div className="relative h-5 rounded-full bg-gray-200">
      <div className="absolute top-0 left-0 h-full w-0 bg-gray-400 rounded-full"></div>
    </div>
  </div>
);

const SkeletonProgressSection: React.FC = () => {
  return (
    <Card className="w-full max-w-lg mx-auto mt-8 shadow-lg">
      <CardHeader>
        <div className="h-6 w-40 bg-gray-300 rounded mb-2"></div>
      </CardHeader>
      <CardContent>
        <SkeletonProgressBar />
        <SkeletonProgressBar />
        <SkeletonProgressBar />
      </CardContent>
    </Card>
  );
};

export default SkeletonProgressSection;
