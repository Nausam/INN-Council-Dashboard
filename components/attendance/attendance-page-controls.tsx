"use client";

import {
  CouncilCard,
  CouncilDatePicker,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarDays, Plus, RefreshCw, Search } from "lucide-react";

type AttendancePageControlsProps = {
  selectedDate: string;
  onDateChange: (value: string) => void;
  onSearch: () => void;
  searchLoading?: boolean;
  searchLabel?: string;
  showGenerate?: boolean;
  onGenerate?: () => void;
  generateLoading?: boolean;
  className?: string;
};

export function AttendancePageControls({
  selectedDate,
  onDateChange,
  onSearch,
  searchLoading = false,
  searchLabel = "Refresh",
  showGenerate = false,
  onGenerate,
  generateLoading = false,
  className,
}: AttendancePageControlsProps) {
  const busy = searchLoading || generateLoading;

  return (
    <CouncilCard interactive="none" className={cn("p-5 sm:p-6", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1 lg:max-w-xs">
          <label
            className="mb-2 block text-sm font-semibold text-slate-700"
            htmlFor="attendance-date"
          >
            Select date
          </label>
          <CouncilDatePicker
            id="attendance-date"
            value={selectedDate}
            onChange={onDateChange}
            icon={CalendarDays}
            placeholder="Pick a date"
            required
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="council"
            className="h-11 rounded-xl px-6"
            onClick={onSearch}
            disabled={busy || !selectedDate}
          >
            {searchLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                {searchLabel}
              </>
            )}
          </Button>

          {showGenerate && onGenerate ? (
            <Button
              type="button"
              variant="council-outline"
              className="h-11 rounded-xl px-6"
              onClick={onGenerate}
              disabled={busy}
            >
              {generateLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Generate sheet
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </CouncilCard>
  );
}
