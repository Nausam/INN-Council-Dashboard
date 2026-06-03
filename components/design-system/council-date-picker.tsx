"use client";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfMonth } from "date-fns";
import { CalendarDays, ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_YEAR_SPAN_PAST = 50;
const DEFAULT_YEAR_SPAN_FUTURE = 10;

type CouncilDatePickerProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: LucideIcon;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** First year in the year dropdown (default: 50 years ago). */
  fromYear?: number;
  /** Last year in the year dropdown (default: 10 years ahead). */
  toYear?: number;
};

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  } catch {
    return undefined;
  }
}

const dropdownLabelClass = cn(
  "inline-flex min-h-9 min-w-[6.25rem] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm",
  "transition-[border-color,background-color] duration-150 hover:border-teal-200 hover:bg-teal-50/60",
);

const calendarClassNames = {
  months: "flex flex-col space-y-4",
  month: "space-y-3",
  caption: "relative mb-1 flex items-center justify-between gap-2 px-0.5",
  caption_label: dropdownLabelClass,
  caption_dropdowns: "flex flex-1 items-center justify-center gap-2",
  dropdown_month: "relative",
  dropdown_year: "relative",
  dropdown: "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0",
  dropdown_icon: "h-3.5 w-3.5 shrink-0 text-slate-400",
  vhidden: "sr-only",
  nav: "flex shrink-0 items-center gap-0.5",
  nav_button: cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm",
    "transition-[background-color,border-color,color,transform] duration-200 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 active:scale-95",
  ),
  nav_button_previous: "",
  nav_button_next: "",
  table: "w-full border-collapse space-y-1",
  head_row: "flex",
  head_cell:
    "w-9 rounded-md text-[0.72rem] font-semibold uppercase tracking-wide text-slate-400",
  row: "mt-2 flex w-full",
  cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:rounded-xl",
  day: cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-xl p-0 text-sm font-medium text-slate-700",
    "transition-[background-color,color,transform] duration-150 hover:bg-teal-50 hover:text-teal-800",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200",
  ),
  day_selected:
    "bg-teal-600 text-white shadow-sm shadow-teal-600/25 hover:bg-teal-600 hover:text-white focus:bg-teal-600 focus:text-white",
  day_today: "bg-teal-50 font-bold text-teal-700 ring-1 ring-teal-200/80",
  day_outside:
    "text-slate-300 opacity-70 aria-selected:bg-teal-50/50 aria-selected:text-teal-700/70",
  day_disabled: "text-slate-300 opacity-40",
};

export function CouncilDatePicker({
  id,
  name,
  value,
  onChange,
  placeholder = "Pick a date",
  icon: Icon = CalendarDays,
  required = false,
  disabled = false,
  className,
  fromYear: fromYearProp,
  toYear: toYearProp,
}: CouncilDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseDateValue(value), [value]);

  const currentYear = new Date().getFullYear();
  const fromYear = fromYearProp ?? currentYear - DEFAULT_YEAR_SPAN_PAST;
  const toYear = toYearProp ?? currentYear + DEFAULT_YEAR_SPAN_FUTURE;

  const [displayMonth, setDisplayMonth] = useState<Date>(() =>
    startOfMonth(selected ?? new Date()),
  );

  useEffect(() => {
    if (selected) {
      setDisplayMonth(startOfMonth(selected));
    }
  }, [selected]);

  useEffect(() => {
    if (open && selected) {
      setDisplayMonth(startOfMonth(selected));
    }
  }, [open, selected]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setOpen(false);
      return;
    }
    onChange("");
  };

  return (
    <div className={cn("relative", className)}>
      {required ? (
        <input type="hidden" name={name ?? id} value={value} required />
      ) : null}

      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            className={cn(
              "council-input group relative flex h-11 w-full items-center pl-10 pr-10 text-left text-sm font-medium transition-[border-color,box-shadow] duration-150",
              "focus-visible:border-teal-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "data-[state=open]:border-teal-300 data-[state=open]:ring-4 data-[state=open]:ring-teal-100",
              value ? "text-slate-700" : "text-slate-400",
            )}
          >
            <Icon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-data-[state=open]:text-teal-600"
              aria-hidden
            />
            <span className="truncate">
              {selected ? format(selected, "PPP") : placeholder}
            </span>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:text-teal-600"
              aria-hidden
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="council-popover-surface council-popover-fast council-date-popover w-auto overflow-hidden border-0 p-0 shadow-xl shadow-slate-200/50 data-[state=closed]:animate-none data-[state=open]:animate-none"
          align="start"
          sideOffset={6}
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700/80">
              Select date
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {selected ? format(selected, "EEEE, MMMM d, yyyy") : placeholder}
            </p>
          </div>

          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            captionLayout="dropdown-buttons"
            fromYear={fromYear}
            toYear={toYear}
            initialFocus
            className="council-calendar p-3"
            classNames={calendarClassNames}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
