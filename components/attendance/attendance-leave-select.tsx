"use client";

import { CouncilPopoverSelect } from "@/components/design-system";
import { leaveTypes as defaultLeaveTypes } from "@/types";
import { cn } from "@/lib/utils";
import { UserCheck } from "lucide-react";
import { useMemo } from "react";

const PRESENT_VALUE = "__present__";

type AttendanceLeaveSelectProps = {
  value: string;
  onValueChange: (leaveLabel: string) => void;
  leaveOptions?: readonly string[];
  disabled?: boolean;
  className?: string;
};

export function AttendanceLeaveSelect({
  value,
  onValueChange,
  leaveOptions = defaultLeaveTypes,
  disabled = false,
  className,
}: AttendanceLeaveSelectProps) {
  const options = useMemo(
    () => [
      { value: PRESENT_VALUE, label: "Present" },
      ...leaveOptions.map((label) => ({ value: label, label })),
    ],
    [leaveOptions],
  );

  const selectedValue = value || PRESENT_VALUE;

  return (
    <CouncilPopoverSelect
      value={selectedValue}
      onValueChange={(next) =>
        onValueChange(next === PRESENT_VALUE ? "" : next)
      }
      options={options}
      icon={UserCheck}
      placeholder="Present"
      disabled={disabled}
      compact
      excludeFromTabOrder
      className={cn(className)}
    />
  );
}
