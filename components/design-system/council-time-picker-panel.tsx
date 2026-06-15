"use client";

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

type TimeParts = {
  hour24: number;
  minute: number;
};

export function parseTimeValue(value: string): TimeParts | null {
  if (!value || !value.includes(":")) return null;
  const [hourRaw, minuteRaw] = value.split(":");
  const hour24 = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (
    Number.isNaN(hour24) ||
    Number.isNaN(minute) ||
    hour24 < 0 ||
    hour24 > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return { hour24, minute };
}

/** Parses typed time strings such as "8:30 AM", "08:30", or "830pm". */
export function parseTypedCouncilTime(input: string): TimeParts | null {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;

  const colonMatch = trimmed.match(
    /^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]?|[AaPp]))?$/,
  );
  if (colonMatch) {
    const hourPart = Number(colonMatch[1]);
    const minute = Number(colonMatch[2]);
    const periodRaw = colonMatch[3];

    if (minute < 0 || minute > 59) return null;

    if (periodRaw) {
      const period: "AM" | "PM" = periodRaw.toUpperCase().startsWith("P")
        ? "PM"
        : "AM";
      if (hourPart < 1 || hourPart > 12) return null;
      return { hour24: to24Hour(hourPart, period), minute };
    }

    if (hourPart < 0 || hourPart > 23) return null;
    return { hour24: hourPart, minute };
  }

  const compactMatch = trimmed.match(/^(\d{3,4})(?:\s*([AaPp][Mm]?|[AaPp]))?$/);
  if (compactMatch) {
    const digits = compactMatch[1];
    const periodRaw = compactMatch[2];
    let hourPart: number;
    let minute: number;

    if (digits.length === 3) {
      hourPart = Number(digits[0]);
      minute = Number(digits.slice(1));
    } else {
      hourPart = Number(digits.slice(0, 2));
      minute = Number(digits.slice(2));
    }

    if (minute < 0 || minute > 59) return null;

    if (periodRaw) {
      const period: "AM" | "PM" = periodRaw.toUpperCase().startsWith("P")
        ? "PM"
        : "AM";
      if (hourPart < 1 || hourPart > 12) return null;
      return { hour24: to24Hour(hourPart, period), minute };
    }

    if (hourPart < 0 || hourPart > 23) return null;
    return { hour24: hourPart, minute };
  }

  return parseTimeValue(trimmed);
}

export function toTimeValue(hour24: number, minute: number): string {
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function to12Hour(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return { hour12, period };
}

export function to24Hour(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export function formatCouncilTimeDisplay(value: string): string {
  const parsed = parseTimeValue(value);
  if (!parsed) return "";
  const { hour12, period } = to12Hour(parsed.hour24);
  return `${String(hour12).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")} ${period}`;
}

const HOURS_12 = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const PERIODS: Array<"AM" | "PM"> = ["AM", "PM"];

function TimePickerColumn<T extends number | string>({
  label,
  items,
  value,
  onSelect,
  formatItem,
}: {
  label: string;
  items: T[];
  value: T;
  onSelect: (item: T) => void;
  formatItem?: (item: T) => string;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center" });
  }, [value]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="mb-1 px-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="council-time-column max-h-44 overflow-y-auto overscroll-contain rounded-xl bg-slate-50/80 p-1 ring-1 ring-slate-200/60">
        {items.map((item) => {
          const isSelected = item === value;
          const display = formatItem ? formatItem(item) : String(item);

          return (
            <button
              key={String(item)}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors duration-100",
                isSelected
                  ? "bg-teal-600 text-white shadow-sm shadow-teal-600/20"
                  : "text-slate-700 hover:bg-teal-50 hover:text-teal-800",
              )}
            >
              {display}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type CouncilTimePickerPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onDone?: () => void;
  onClear?: () => void;
  showClear?: boolean;
  headerLabel?: string;
  placeholder?: string;
};

export function CouncilTimePickerPanel({
  value,
  onChange,
  onDone,
  onClear,
  showClear = true,
  headerLabel = "Select time",
  placeholder = "Set time",
}: CouncilTimePickerPanelProps) {
  const parsed = useMemo(() => parseTimeValue(value), [value]);
  const initial = parsed ?? { hour24: 8, minute: 0 };
  const initial12 = to12Hour(initial.hour24);

  const [draftHour12, setDraftHour12] = useState(initial12.hour12);
  const [draftMinute, setDraftMinute] = useState(initial.minute);
  const [draftPeriod, setDraftPeriod] = useState<"AM" | "PM">(initial12.period);

  useEffect(() => {
    const next = parsed ?? { hour24: 8, minute: 0 };
    const next12 = to12Hour(next.hour24);
    setDraftHour12(next12.hour12);
    setDraftMinute(next.minute);
    setDraftPeriod(next12.period);
  }, [parsed, value]);

  const applyDraft = (
    hour12: number,
    minute: number,
    period: "AM" | "PM",
  ) => {
    onChange(toTimeValue(to24Hour(hour12, period), minute));
  };

  const previewValue = formatCouncilTimeDisplay(
    toTimeValue(to24Hour(draftHour12, draftPeriod), draftMinute),
  );

  return (
    <>
      <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-white px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700/80">
          {headerLabel}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">
          {previewValue || placeholder}
        </p>
      </div>

      <div className="flex gap-2 p-3">
        <TimePickerColumn
          label="Hour"
          items={HOURS_12}
          value={draftHour12}
          onSelect={(hour12) => {
            setDraftHour12(hour12);
            applyDraft(hour12, draftMinute, draftPeriod);
          }}
          formatItem={(hour) => String(hour).padStart(2, "0")}
        />
        <TimePickerColumn
          label="Min"
          items={MINUTES}
          value={draftMinute}
          onSelect={(minute) => {
            setDraftMinute(minute);
            applyDraft(draftHour12, minute, draftPeriod);
          }}
          formatItem={(minute) => String(minute).padStart(2, "0")}
        />
        <TimePickerColumn
          label=" "
          items={PERIODS}
          value={draftPeriod}
          onSelect={(period) => {
            setDraftPeriod(period);
            applyDraft(draftHour12, draftMinute, period);
          }}
        />
      </div>

      {(showClear || onDone) && (
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2">
          {showClear ? (
            <button
              type="button"
              className="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
              onClick={onClear}
            >
              Clear
            </button>
          ) : null}
          {onDone ? (
            <button
              type="button"
              className="flex-1 rounded-lg bg-teal-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
              onClick={onDone}
            >
              Done
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}
