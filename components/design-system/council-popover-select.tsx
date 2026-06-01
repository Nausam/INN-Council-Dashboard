"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

export type CouncilPopoverSelectOption = {
  value: string;
  label: string;
};

type CouncilPopoverSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: CouncilPopoverSelectOption[];
  placeholder?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
};

export function CouncilPopoverSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  icon: Icon,
  disabled = false,
  className,
  compact = false,
}: CouncilPopoverSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "council-input group relative flex w-full items-center text-left text-sm font-medium transition-[border-color,box-shadow] duration-150",
            "focus-visible:border-teal-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "data-[state=open]:border-teal-300 data-[state=open]:ring-4 data-[state=open]:ring-teal-100",
            compact ? "h-10 py-2 pl-9 pr-9" : "h-11 pl-10 pr-10",
            Icon ? (compact ? "pl-9" : "pl-10") : compact ? "pl-3" : "pl-4",
            selectedLabel ? "text-slate-700" : "text-slate-400",
            className,
          )}
        >
          {Icon ? (
            <Icon
              className={cn(
                "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-data-[state=open]:text-teal-600",
                compact ? "left-2.5" : "left-3",
              )}
              aria-hidden
            />
          ) : null}
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronDown
            className={cn(
              "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform duration-150 group-data-[state=open]:rotate-180 group-data-[state=open]:text-teal-600",
              compact ? "right-2.5" : "right-3",
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          "council-popover-surface council-popover-fast z-[120] max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto overscroll-contain border-0 p-1.5 shadow-xl shadow-slate-200/50",
          "data-[state=closed]:animate-none data-[state=open]:animate-none",
        )}
      >
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors duration-100",
                "hover:bg-teal-50 hover:text-teal-900",
                isSelected && "bg-teal-50/90 font-semibold text-teal-800",
              )}
            >
              <span className="truncate">{option.label}</span>
              {isSelected ? (
                <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-teal-600" />
              ) : null}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
