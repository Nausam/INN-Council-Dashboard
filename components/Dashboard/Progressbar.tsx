import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  label: string;
  color: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, label, color }) => (
  <div className="mb-6">
    <div className="flex justify-between mb-2">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-600">{value}%</span>
    </div>
    <div className="relative h-5 rounded-full overflow-hidden bg-gray-200">
      <div
        className={cn(
          "absolute top-0 left-0 h-full transition-all duration-500 ease-in-out",
          color
        )}
        style={{ width: `${value}%` }}
      ></div>
    </div>
  </div>
);

const ProgressSection: React.FC<{
  onTimePercent: number;
  latePercent: number;
  absentPercent: number;
}> = ({ onTimePercent, latePercent, absentPercent }) => {
  return (
    <Card className="w-full max-w-lg mx-auto mt-8 shadow-lg">
      <CardHeader>
        <CardTitle>Attendance Percentage</CardTitle>
      </CardHeader>
      <CardContent>
        <ProgressBar
          value={onTimePercent}
          label="On Time"
          color="bg-green-500"
        />
        <ProgressBar value={latePercent} label="Late" color="bg-yellow-500" />
        <ProgressBar value={absentPercent} label="Absent" color="bg-red-500" />
      </CardContent>
    </Card>
  );
};

export default ProgressSection;
