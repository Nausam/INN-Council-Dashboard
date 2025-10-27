import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

interface ProgressBarProps {
  value: number;
  label: string;
  gradient: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  gradient,
}) => (
  <div className="mb-6">
    <div className="flex justify-between mb-2">
      <span className="text-base font-medium text-gray-700">{label}</span>
      <span className="text-base font-bold text-gray-800">{value}%</span>
    </div>
    <div className="relative h-8 rounded-full overflow-hidden bg-gray-200 shadow-inner">
      <div
        className={cn(
          "absolute top-0 left-0 h-full transition-all duration-700 ease-in-out rounded-full"
        )}
        style={{
          width: `${value}%`,
          background: gradient,
          boxShadow: `0px 4px 10px 0px rgba(0, 0, 0, 0.15) inset`,
        }}
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
    <Card
      style={{
        background: "linear-gradient(to bottom right, #fdfdfd, #f8f8f8)",
      }}
      className="w-full mx-auto mt-8 shadow-lg rounded-xl border-none p-6 "
    >
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-800 mb-4">
          Attendance Percentage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProgressBar
          value={onTimePercent}
          label="On Time"
          gradient="linear-gradient(135deg, #56AB2F, #A8E063)"
        />
        <ProgressBar
          value={latePercent}
          label="Late"
          gradient="linear-gradient(135deg, #F2994A, #F2C94C)"
        />
        <ProgressBar
          value={absentPercent}
          label="On Leave"
          gradient="linear-gradient(135deg, #EB5757, #F2994A)"
        />
      </CardContent>
    </Card>
  );
};

export default ProgressSection;
