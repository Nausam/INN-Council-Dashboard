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
import { ChevronDown, Clock, type LucideIcon } from "lucide-react";
import { useState } from "react";

type CouncilTimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
};

export function CouncilTimePicker({
  id,
  value,
  onChange,
  placeholder = "Set time",
  icon: Icon = Clock,
  disabled = false,
  className,
  compact = false,
}: CouncilTimePickerProps) {
  const [open, setOpen] = useState(false);
  const displayValue = formatCouncilTimeDisplay(value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            "council-input group relative flex w-full items-center text-left text-sm font-semibold transition-[border-color,box-shadow] duration-150",
            "focus-visible:border-teal-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
            "data-[state=open]:border-teal-300 data-[state=open]:ring-4 data-[state=open]:ring-teal-100",
            compact ? "h-10 py-2 pl-7 pr-7 text-xs" : "h-11 pl-10 pr-10",
            displayValue ? "text-slate-900" : "text-slate-400",
            className,
          )}
        >
          {!compact ? (
            <Icon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-data-[state=open]:text-teal-600"
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              "block w-full whitespace-nowrap text-center tabular-nums",
              compact ? "px-0" : "truncate text-left",
            )}
          >
            {displayValue || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform duration-150 group-data-[state=open]:rotate-180 group-data-[state=open]:text-teal-600",
              compact ? "right-2" : "right-3",
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          "council-popover-surface council-popover-fast council-time-popover z-[120] w-[min(100vw-2rem,17rem)] overflow-hidden border-0 p-0 shadow-xl shadow-slate-200/50",
          "data-[state=closed]:animate-none data-[state=open]:animate-none",
        )}
      >
        <CouncilTimePickerPanel
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onClear={() => {
            onChange("");
            setOpen(false);
          }}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

export {
  formatCouncilTimeDisplay,
  CouncilTimePickerPanel,
} from "./council-time-picker-panel";

/** @deprecated Use CouncilTimePicker */
export const CouncilTimeInput = CouncilTimePicker;
