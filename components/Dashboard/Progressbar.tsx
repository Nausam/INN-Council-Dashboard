import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-600">{value}%</span>
    </div>
    <div className="relative h-6 rounded-full overflow-hidden bg-gray-300 shadow-inner">
      <div
        className={cn(
          "absolute top-0 left-0 h-full transition-all duration-500 ease-in-out rounded-full shadow-lg"
        )}
        style={{
          width: `${value}%`,
          background: gradient, // Using the gradient prop here
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
    <Card className="w-full max-w-lg mx-auto mt-8 shadow-xl rounded-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-gray-700">
          Attendance Percentage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ProgressBar
          value={onTimePercent}
          label="On Time"
          gradient="linear-gradient(135deg,  #56AB2F, #A8E063)"
        />
        <ProgressBar
          value={latePercent}
          label="Late"
          gradient="linear-gradient(135deg,  #F2994A, #F2C94C)"
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
