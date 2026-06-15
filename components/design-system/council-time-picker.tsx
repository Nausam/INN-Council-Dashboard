"use client";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  CouncilTimePickerPanel,
  formatCouncilTimeDisplay,
  parseTypedCouncilTime,
  toTimeValue,
} from "@/components/design-system/council-time-picker-panel";
import { cn } from "@/lib/utils";
import { ChevronDown, Clock, type LucideIcon } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

type CouncilTimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  /** When true, Tab moves to the next `[data-attendance-sign-in]` field (skips status controls). */
  chainTabToNext?: boolean;
};

function getAttendanceSignInInputs(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      "[data-attendance-sign-in]:not([disabled])",
    ),
  );
}

function focusAdjacentAttendanceSignIn(
  current: HTMLInputElement,
  direction: 1 | -1,
) {
  const inputs = getAttendanceSignInInputs();
  const index = inputs.indexOf(current);
  if (index === -1) return false;

  const next = inputs[index + direction];
  if (!next) return false;

  next.focus();
  return true;
}

export function CouncilTimePicker({
  id,
  value,
  onChange,
  placeholder = "Set time",
  icon: Icon = Clock,
  disabled = false,
  className,
  compact = false,
  chainTabToNext = false,
}: CouncilTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = formatCouncilTimeDisplay(value);

  const commitDraft = () => {
    const trimmed = draftText.trim();
    if (!trimmed) {
      if (value) onChange("");
      return;
    }

    const parsed = parseTypedCouncilTime(trimmed);
    if (parsed) {
      const normalized = toTimeValue(parsed.hour24, parsed.minute);
      if (normalized !== value) onChange(normalized);
      return;
    }

    setDraftText(displayValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      inputRef.current?.blur();
      return;
    }

    if (event.key === "Escape") {
      setDraftText(displayValue);
      inputRef.current?.blur();
      return;
    }

    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (event.key === "Tab" && chainTabToNext && inputRef.current) {
      const moved = focusAdjacentAttendanceSignIn(
        inputRef.current,
        event.shiftKey ? -1 : 1,
      );
      if (moved) {
        event.preventDefault();
        commitDraft();
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "council-input group relative flex w-full items-center text-sm font-semibold transition-[border-color,box-shadow] duration-150",
            "focus-within:border-teal-300 focus-within:outline-none focus-within:ring-4 focus-within:ring-teal-100",
            "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
            open && "border-teal-300 ring-4 ring-teal-100",
            compact ? "h-10" : "h-11",
            className,
          )}
        >
          {!compact ? (
            <Icon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-teal-600"
              aria-hidden
            />
          ) : null}
          <input
            ref={inputRef}
            id={id}
            type="text"
            disabled={disabled}
            {...(chainTabToNext ? { "data-attendance-sign-in": true } : {})}
            value={isEditing ? draftText : displayValue}
            placeholder={placeholder}
            onFocus={() => {
              setIsEditing(true);
              setDraftText(displayValue || "");
            }}
            onChange={(event) => setDraftText(event.target.value)}
            onBlur={() => {
              commitDraft();
              setIsEditing(false);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400 tabular-nums",
              compact
                ? "h-10 py-2 pl-2 pr-7 text-center text-xs"
                : "h-11 py-2 pl-10 pr-10 text-left",
              displayValue || (isEditing && draftText)
                ? "text-slate-900"
                : "text-slate-400",
            )}
          />
          <button
            type="button"
            disabled={disabled}
            tabIndex={chainTabToNext ? -1 : undefined}
            aria-label="Open time picker"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen((prev) => !prev)}
            className={cn(
              "absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-teal-600",
              open && "text-teal-600",
              compact ? "right-1" : "right-2",
            )}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-150",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>
      </PopoverAnchor>

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
  parseTypedCouncilTime,
} from "./council-time-picker-panel";

/** @deprecated Use CouncilTimePicker */
export const CouncilTimeInput = CouncilTimePicker;
