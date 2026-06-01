"use client";

import { CouncilCard, CouncilPopoverSelect } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Clock,
  Eye,
  FileText,
  Minus,
  Printer,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type RangeKey = "A" | "B" | "BOTH";
type HeadingMode = "ATTENDANCE" | "SHEET2";
type ImamOptionKey =
  | "Shahidh"
  | "Zahidh"
  | "Umair"
  | "Neem"
  | "Yazaan"
  | "Ibraheem";

type PrayerGroup = {
  key: string;
  label: string;
};

type MonthOption = {
  value: number;
  label: string;
};

type RangeOptions = {
  A: { from: number; to: number; label: string };
  B: { from: number; to: number; label: string };
  BOTH: { from: number; to: number; label: string };
};

type PrayerSelect = string | "ALL";

type GroupKey = string;

type EmptyRules = Record<number, Partial<Record<string, true>>>;

type AttendanceSheetControlsPanelProps = {
  monthLabel: string;
  year: number;
  onYearChange: (year: number) => void;
  month: number;
  onMonthChange: (month: number) => void;
  months: readonly MonthOption[];
  deductMins: number;
  onDeductMinsChange: (mins: number) => void;
  viewSelect: RangeKey;
  onViewSelectChange: (value: RangeKey) => void;
  ranges: RangeOptions;
  headingMode: HeadingMode;
  onHeadingModeChange: (value: HeadingMode) => void;
  imamKey: ImamOptionKey;
  onImamKeyChange: (value: ImamOptionKey) => void;
  emptyDay: number;
  onEmptyDayChange: (day: number) => void;
  emptyPrayer: PrayerSelect;
  onEmptyPrayerChange: (value: PrayerSelect) => void;
  dim: number;
  prayerGroups: readonly PrayerGroup[];
  emptyRules: EmptyRules;
  onApplyEmptyRule: () => void;
  onClearEmptyRules: () => void;
  onRemoveEmptyRule: (day: number) => void;
  groupLabel: (key: GroupKey) => string;
  onPrint: () => void;
};

const IMAM_OPTIONS: { value: ImamOptionKey; label: string }[] = [
  { value: "Shahidh", label: "ސާހިދު" },
  { value: "Zahidh", label: "ޒާހިދު" },
  { value: "Umair", label: "އުމައިރު" },
  { value: "Neem", label: "ނީމް" },
  { value: "Yazaan", label: "ޔަޒާން" },
  { value: "Ibraheem", label: "އިބްރާޙީމް ޙަލީމް" },
];

const HEADING_OPTIONS: { value: HeadingMode; label: string }[] = [
  { value: "ATTENDANCE", label: "އިމާމު" },
  { value: "SHEET2", label: "ޕޫލް" },
];

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

export function AttendanceSheetControlsPanel({
  monthLabel,
  year,
  onYearChange,
  month,
  onMonthChange,
  months,
  deductMins,
  onDeductMinsChange,
  viewSelect,
  onViewSelectChange,
  ranges,
  headingMode,
  onHeadingModeChange,
  imamKey,
  onImamKeyChange,
  emptyDay,
  onEmptyDayChange,
  emptyPrayer,
  onEmptyPrayerChange,
  dim,
  prayerGroups,
  emptyRules,
  onApplyEmptyRule,
  onClearEmptyRules,
  onRemoveEmptyRule,
  groupLabel,
  onPrint,
}: AttendanceSheetControlsPanelProps) {
  const activeRulesCount = Object.keys(emptyRules).length;

  const monthOptions = months.map((m) => ({
    value: String(m.value),
    label: m.label,
  }));

  const viewOptions = [
    { value: "A", label: ranges.A.label },
    { value: "B", label: ranges.B.label },
    { value: "BOTH", label: ranges.BOTH.label },
  ];

  const dayOptions = Array.from({ length: dim }, (_, index) => {
    const day = index + 1;
    return { value: String(day), label: String(day) };
  });

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
                ކޮންޓްރޯލް ޕެނަލް
              </h3>
              <p className="text-sm font-medium text-slate-500">
                {monthLabel} {year}
              </p>
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
          <ControlField label="މަސް" icon={CalendarDays}>
            <CouncilPopoverSelect
              value={String(month)}
              onValueChange={(value) => onMonthChange(Number(value))}
              options={monthOptions}
              icon={CalendarDays}
              placeholder="Select month"
            />
          </ControlField>

          <ControlField label="އަހަރު" icon={Clock}>
            <input
              type="number"
              value={year}
              onChange={(e) => onYearChange(Number(e.target.value) || year)}
              className="council-input h-11 text-center text-sm font-semibold"
            />
          </ControlField>

          <ControlField label="ކަނޑާ މިނަޓް" icon={Minus}>
            <input
              type="number"
              min={0}
              max={180}
              step={1}
              value={deductMins}
              onChange={(e) => onDeductMinsChange(Number(e.target.value))}
              className="council-input h-11 text-center text-sm font-semibold"
            />
          </ControlField>

          <ControlField label="View" icon={Eye}>
            <CouncilPopoverSelect
              value={viewSelect}
              onValueChange={(value) =>
                onViewSelectChange(value as RangeKey)
              }
              options={viewOptions}
              icon={Eye}
              placeholder="Select range"
            />
          </ControlField>

          <ControlField label="ހެޑިންގް" icon={FileText}>
            <CouncilPopoverSelect
              value={headingMode}
              onValueChange={(value) =>
                onHeadingModeChange(value as HeadingMode)
              }
              options={HEADING_OPTIONS}
              icon={FileText}
              placeholder="Select heading"
            />
          </ControlField>

          <ControlField label="އިމާމް / މުދިމު" icon={User}>
            <CouncilPopoverSelect
              value={imamKey}
              onValueChange={(value) =>
                onImamKeyChange(value as ImamOptionKey)
              }
              options={IMAM_OPTIONS}
              icon={User}
              placeholder="Select imam"
            />
          </ControlField>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 ring-1 ring-slate-200/50">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/80">
              <X className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-black text-slate-900">Empty Rules</h4>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 ring-1 ring-teal-100">
              {activeRulesCount} active
            </span>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <ControlField label="Day" icon={CalendarDays} className="lg:flex-1">
              <CouncilPopoverSelect
                value={String(emptyDay)}
                onValueChange={(value) => onEmptyDayChange(Number(value))}
                options={dayOptions}
                placeholder="Day"
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
                Apply rule
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
        </div>
      </CouncilCard>

      {activeRulesCount > 0 ? (
        <div className="flex flex-wrap justify-end gap-2">
          {Object.entries(emptyRules)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([dayStr, rules]) => {
              const day = Number(dayStr);
              const keys = prayerGroups
                .filter((group) => rules[group.key])
                .map((group) => group.key);

              const label =
                keys.length === prayerGroups.length
                  ? `Day ${day}: All`
                  : `Day ${day}: ${keys.map(groupLabel).join("، ")}`;

              return (
                <button
                  key={dayStr}
                  type="button"
                  onClick={() => onRemoveEmptyRule(day)}
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
  );
}
