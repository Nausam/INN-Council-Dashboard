"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown, type LucideIcon } from "lucide-react";

export type CouncilSelectOption = {
  value: string;
  label: string;
};

type CouncilSelectProps = {
  id?: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: CouncilSelectOption[];
  placeholder?: string;
  icon?: LucideIcon;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function CouncilSelect({
  id,
  name,
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  icon: Icon,
  required = false,
  disabled = false,
  className,
}: CouncilSelectProps) {
  return (
    <div className={cn("relative", className)}>
      {required ? (
        <input type="hidden" name={name ?? id} value={value} required />
      ) : null}

      <Select
        value={value || undefined}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          hideChevron
          className={cn(
            "council-input group relative h-11 shadow-sm transition-[border-color,box-shadow] duration-150",
            "focus:ring-4 focus:ring-teal-100 data-[state=open]:border-teal-300 data-[state=open]:ring-4 data-[state=open]:ring-teal-100",
            Icon ? "pl-10" : "pl-4",
            "pr-10 text-sm font-medium text-slate-700",
            !value && "text-slate-400",
          )}
        >
          {Icon ? (
            <Icon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-data-[state=open]:text-teal-600"
              aria-hidden
            />
          ) : null}
          <SelectValue placeholder={placeholder} className="truncate text-left" />
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-[transform,color] duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:text-teal-600"
            aria-hidden
          />
        </SelectTrigger>

        <SelectContent
          className="council-popover-surface council-popover-fast council-select-content z-[100] max-h-72 overflow-hidden border-0 p-0 shadow-xl shadow-slate-200/50 data-[state=closed]:animate-none data-[state=open]:animate-none"
          position="popper"
          sideOffset={6}
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className={cn(
                "relative cursor-pointer rounded-xl py-2.5 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors duration-150",
                "focus:bg-teal-50 focus:text-teal-900 data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-900",
                "data-[state=checked]:bg-teal-50/90 data-[state=checked]:font-semibold data-[state=checked]:text-teal-800",
                "[&_[data-radix-select-item-indicator]]:text-teal-600",
              )}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
