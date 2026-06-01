"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CouncilTimePickerPanel,
  formatCouncilTimeDisplay,
} from "@/components/design-system/council-time-picker-panel";
import { cn } from "@/lib/utils";
import { ChevronDown, UserX } from "lucide-react";
import { useState } from "react";

type PrayerAttendancePickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  disabledLabel?: string;
  className?: string;
};

export function PrayerAttendancePicker({
  value,
  onChange,
  disabled = false,
  disabledLabel = "On leave",
  className,
}: PrayerAttendancePickerProps) {
  const [open, setOpen] = useState(false);
  const isAbsent = !disabled && value === null;
  const displayTime = value ? formatCouncilTimeDisplay(value) : "";
  const triggerLabel = disabled
    ? disabledLabel
    : isAbsent
      ? "Absent"
      : displayTime || "Set time";

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "council-input group relative flex h-10 w-full items-center text-xs font-semibold transition-[border-color,box-shadow] duration-150",
            "focus-visible:border-teal-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
            "data-[state=open]:border-teal-300 data-[state=open]:ring-4 data-[state=open]:ring-teal-100",
            "py-2 pl-7 pr-7",
            isAbsent
              ? "border-rose-200 bg-rose-50/70 text-rose-700"
              : disabled
                ? "text-slate-400"
                : displayTime
                  ? "text-slate-900"
                  : "text-slate-400",
            className,
          )}
        >
          <span className="block w-full whitespace-nowrap text-center tabular-nums">
            {triggerLabel}
          </span>
          <ChevronDown
            className={cn(
              "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 transition-transform duration-150 group-data-[state=open]:rotate-180",
              isAbsent
                ? "text-rose-500 group-data-[state=open]:text-rose-600"
                : "text-slate-400 group-data-[state=open]:text-teal-600",
              "right-2",
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          "council-popover-surface council-popover-fast z-[120] w-[min(100vw-2rem,17rem)] overflow-hidden border-0 p-0 shadow-xl shadow-slate-200/50",
          "data-[state=closed]:animate-none data-[state=open]:animate-none",
        )}
      >
        <div className="border-b border-slate-100 p-2">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-100",
              isAbsent
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/20"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100",
            )}
          >
            <UserX className="h-4 w-4" />
            Absent
          </button>
        </div>

        <CouncilTimePickerPanel
          value={value ?? ""}
          onChange={(next) => onChange(next || null)}
          headerLabel="Sign-in time"
          placeholder="Pick a time"
          showClear={false}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
