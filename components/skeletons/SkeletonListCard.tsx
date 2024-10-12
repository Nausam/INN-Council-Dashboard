import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SkeletonListCard: React.FC = () => {
  return (
    <Card className="w-full max-w-lg mx-auto mt-6 shadow-lg">
      <CardHeader>
        <CardTitle>
          <div className="h-6 bg-gray-300 rounded w-2/4 animate-pulse"></div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {/* Create 3 placeholder skeletons for employees */}

          <div className="p-2 rounded-md shadow-md text-sm bg-gray-300 animate-pulse w-24 h-6"></div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SkeletonListCard;
