"use client";

import { CouncilTimePicker } from "@/components/design-system";
import { cn } from "@/lib/utils";

type AttendanceTimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function AttendanceTimeInput({
  value,
  onChange,
  disabled = false,
  className,
}: AttendanceTimeInputProps) {
  return (
    <CouncilTimePicker
      value={value}
      onChange={onChange}
      disabled={disabled}
      compact
      chainTabToNext
      placeholder="--:-- --"
      className={cn(className)}
    />
  );
}
