"use client";

import { CouncilCard, CouncilPopoverSelect } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Clock,
  Eye,
  FileText,
  Hash,
  Printer,
  SlidersHorizontal,
  Timer,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type RangeKey = "A" | "B" | "BOTH";
type ImamOptionKey = "Shahidh" | "Zahidh";

type MonthOption = {
  value: number;
  label: string;
};

type RangeOptions = {
  A: { from: string; to: string; label: string };
  B: { from: string; to: string; label: string };
  BOTH: { from: string; to: string; label: string };
};

type PrayerGroup = {
  key: string;
  label: string;
};

type PrayerSelect = string | "ALL";

type GroupKey = string;

type EmptyRules = Record<string, Partial<Record<string, true>>>;

type DateEntry = {
  iso: string;
  year: number;
  month0: number;
  day: number;
  weekday: number;
};

type MonthGroup = {
  year: number;
  month0: number;
  items: DateEntry[];
};

type OtSheetControlsPanelProps = {
  rangeSubtitle: string;
  endMonth: number;
  onEndMonthChange: (month: number) => void;
  months: readonly MonthOption[];
  endYear: number;
  onEndYearChange: (year: number) => void;
  otMinutes: number;
  onOtMinutesChange: (minutes: number) => void;
  viewSelect: RangeKey;
  onViewSelectChange: (value: RangeKey) => void;
  printSelect: RangeKey;
  onPrintSelectChange: (value: RangeKey) => void;
  ranges: RangeOptions;
  imamKey: ImamOptionKey;
  onImamKeyChange: (value: ImamOptionKey) => void;
  imamOptions: { value: ImamOptionKey; label: string }[];
  empName: string;
  onEmpNameChange: (value: string) => void;
  empPosition: string;
  onEmpPositionChange: (value: string) => void;
  empId: string;
  onEmpIdChange: (value: string) => void;
  holidayDates: Set<string>;
  onToggleHoliday: (iso: string) => void;
  onClearHolidays: () => void;
  holidayCount: number;
  rangeByMonth: MonthGroup[];
  englishMonths: readonly string[];
  weekdayLabels: Record<number, string>;
  emptyIso: string;
  onEmptyIsoChange: (iso: string) => void;
  dayOptions: { value: string; label: string }[];
  emptyPrayer: PrayerSelect;
  onEmptyPrayerChange: (value: PrayerSelect) => void;
  prayerGroups: readonly PrayerGroup[];
  emptyRules: EmptyRules;
  onApplyEmptyRule: () => void;
  onClearEmptyRules: () => void;
  onRemoveEmptyRule: (iso: string) => void;
  groupLabel: (key: GroupKey) => string;
  onPrint: () => void;
};

function ControlField({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
        <Icon className="h-3.5 w-3.5 text-teal-600" aria-hidden />
        {label}
      </label>
      {children}
    </div>
  );
}

export function OtSheetControlsPanel({
  rangeSubtitle,
  endMonth,
  onEndMonthChange,
  months,
  endYear,
  onEndYearChange,
  otMinutes,
  onOtMinutesChange,
  viewSelect,
  onViewSelectChange,
  printSelect,
  onPrintSelectChange,
  ranges,
  imamKey,
  onImamKeyChange,
  imamOptions,
  empName,
  onEmpNameChange,
  empPosition,
  onEmpPositionChange,
  empId,
  onEmpIdChange,
  holidayDates,
  onToggleHoliday,
  onClearHolidays,
  holidayCount,
  rangeByMonth,
  englishMonths,
  weekdayLabels,
  emptyIso,
  onEmptyIsoChange,
  dayOptions,
  emptyPrayer,
  onEmptyPrayerChange,
  prayerGroups,
  emptyRules,
  onApplyEmptyRule,
  onClearEmptyRules,
  onRemoveEmptyRule,
  groupLabel,
  onPrint,
}: OtSheetControlsPanelProps) {
  const activeRulesCount = Object.keys(emptyRules).length;

  const monthOptions = months.map((m) => ({
    value: String(m.value),
    label: m.label,
  }));

  const rangeOptions = [
    { value: "A", label: ranges.A.label },
    { value: "B", label: ranges.B.label },
    { value: "BOTH", label: ranges.BOTH.label },
  ];

  const prayerOptions = [
    { value: "ALL", label: "All prayers" },
    ...prayerGroups.map((group) => ({
      value: group.key,
      label: group.label,
    })),
  ];

  return (
    <div className="no-print mb-6 space-y-4">
      <CouncilCard interactive="none" className="p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
              <SlidersHorizontal className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                OT ޝީޓް ކޮންޓްރޯލް
              </h3>
              <p className="text-sm font-medium text-slate-500">{rangeSubtitle}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="council"
            className="h-11 rounded-xl px-5"
            onClick={onPrint}
          >
            <Printer className="h-4 w-4" />
            ޕްރިންޓް
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <ControlField label="އިމާމް" icon={User}>
            <CouncilPopoverSelect
              value={imamKey}
              onValueChange={(value) =>
                onImamKeyChange(value as ImamOptionKey)
              }
              options={imamOptions}
              icon={User}
              placeholder="Select imam"
            />
          </ControlField>

          <ControlField label="މަސް (10ވަނަ ދުވަހުން ނިމޭ)" icon={CalendarDays}>
            <CouncilPopoverSelect
              value={String(endMonth)}
              onValueChange={(value) => onEndMonthChange(Number(value))}
              options={monthOptions}
              icon={CalendarDays}
              placeholder="Select month"
            />
          </ControlField>

          <ControlField label="އަހަރު" icon={Clock}>
            <input
              type="number"
              value={endYear}
              onChange={(e) => onEndYearChange(Number(e.target.value) || endYear)}
              className="council-input h-11 text-center text-sm font-semibold"
            />
          </ControlField>

          <ControlField label="OT (މިނަޓް)" icon={Timer}>
            <input
              type="number"
              min={0}
              max={480}
              step={1}
              value={otMinutes}
              onChange={(e) => onOtMinutesChange(Number(e.target.value))}
              className="council-input h-11 text-center text-sm font-semibold"
            />
          </ControlField>

          <ControlField label="View" icon={Eye}>
            <CouncilPopoverSelect
              value={viewSelect}
              onValueChange={(value) =>
                onViewSelectChange(value as RangeKey)
              }
              options={rangeOptions}
              icon={Eye}
              placeholder="Select range"
            />
          </ControlField>

          <ControlField label="Print" icon={Printer}>
            <CouncilPopoverSelect
              value={printSelect}
              onValueChange={(value) =>
                onPrintSelectChange(value as RangeKey)
              }
              options={rangeOptions}
              icon={Printer}
              placeholder="Select range"
            />
          </ControlField>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ControlField label="ނަން" icon={User}>
            <input
              value={empName}
              onChange={(e) => onEmpNameChange(e.target.value)}
              className="council-input h-11 text-sm font-semibold"
            />
          </ControlField>

          <ControlField label="މަޤާމް" icon={FileText}>
            <input
              value={empPosition}
              onChange={(e) => onEmpPositionChange(e.target.value)}
              className="council-input h-11 text-sm font-semibold"
            />
          </ControlField>

          <ControlField label="އައިޑީ ނަންބަރު" icon={Hash}>
            <input
              value={empId}
              onChange={(e) => onEmpIdChange(e.target.value)}
              className="council-input h-11 text-sm font-semibold"
            />
          </ControlField>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 ring-1 ring-slate-200/50">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                <CalendarDays className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-black text-slate-900">
                ބަންދު ދުވަސްތައް (Click to toggle)
              </h4>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 ring-1 ring-teal-100">
                {holidayCount} day{holidayCount === 1 ? "" : "s"}
              </span>
            </div>

            <Button
              type="button"
              variant="council-outline"
              className="h-9 rounded-xl px-4 text-xs"
              onClick={onClearHolidays}
            >
              Clear all
            </Button>
          </div>

          <div className="space-y-4">
            {rangeByMonth.map((grp) => (
              <div key={`${grp.year}-${grp.month0}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {englishMonths[grp.month0]} {grp.year}
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid grid-cols-7 gap-2 sm:grid-cols-10 md:grid-cols-[repeat(15,minmax(0,1fr))]">
                  {grp.items.map((d) => {
                    const isHoliday = holidayDates.has(d.iso);
                    const isWeekend = d.weekday === 5 || d.weekday === 6;

                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => onToggleHoliday(d.iso)}
                        title={weekdayLabels[d.weekday]}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-xs font-bold transition-all",
                          isHoliday
                            ? "border-teal-300 bg-teal-50 text-teal-900 shadow-sm ring-1 ring-teal-100"
                            : isWeekend
                              ? "border-slate-300 bg-slate-50 text-slate-600 hover:border-teal-200 hover:bg-teal-50/50"
                              : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/40",
                        )}
                      >
                        <span className="text-sm">{d.day}</span>
                        <span className="text-[10px] opacity-70">
                          {weekdayLabels[d.weekday]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 ring-1 ring-slate-200/50">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/80">
              <X className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-black text-slate-900">Exclude Prayers</h4>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 ring-1 ring-teal-100">
              {activeRulesCount} active
            </span>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <ControlField label="Day" icon={CalendarDays} className="lg:flex-1">
              <CouncilPopoverSelect
                value={emptyIso}
                onValueChange={onEmptyIsoChange}
                options={dayOptions}
                placeholder="Select day"
              />
            </ControlField>

            <ControlField label="Prayer" icon={Clock} className="lg:flex-[1.4]">
              <CouncilPopoverSelect
                value={emptyPrayer}
                onValueChange={(value) =>
                  onEmptyPrayerChange(value as PrayerSelect)
                }
                options={prayerOptions}
                placeholder="All prayers"
              />
            </ControlField>

            <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
              <Button
                type="button"
                variant="council"
                className="h-11 rounded-xl px-5"
                onClick={onApplyEmptyRule}
              >
                Apply
              </Button>
              <Button
                type="button"
                variant="council-outline"
                className="h-11 rounded-xl px-5"
                onClick={onClearEmptyRules}
              >
                Clear all
              </Button>
            </div>
          </div>

          {activeRulesCount > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(emptyRules)
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .map(([iso, rules]) => {
                  const keys = prayerGroups
                    .filter((group) => rules[group.key])
                    .map((group) => group.key);
                  const parts = iso.split("-");
                  const label =
                    keys.length === prayerGroups.length
                      ? `${parts[2]}/${parts[1]}: All`
                      : `${parts[2]}/${parts[1]}: ${keys.map(groupLabel).join("، ")}`;

                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => onRemoveEmptyRule(iso)}
                      className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-3 py-1.5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100"
                      title="Remove rule"
                    >
                      <span>{label}</span>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
            </div>
          ) : null}
        </div>
      </CouncilCard>
    </div>
  );
}
