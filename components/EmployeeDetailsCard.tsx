"use client";

import { AvatarGlow, CouncilCard } from "@/components/design-system";
import { statTones, typography, type StatTone } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import {
  Award,
  Baby,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  Heart,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React from "react";

type EmployeeForCard = {
  name: string;
  designation: string;
  sickLeave: number;
  certificateSickLeave: number;
  annualLeave: number;
  familyRelatedLeave: number;
  preMaternityLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  noPayLeave: number;
  officialLeave: number;
  joinedDate: string;
};

interface EmployeeDetailsCardProps {
  employee: EmployeeForCard;
}

type LeaveCategory = {
  label: string;
  value: number;
  totalAllowance?: number;
  icon: LucideIcon;
  tone: StatTone;
};

function formatDate(dateString: string) {
  if (!dateString) return "Not specified";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

const EmployeeDetailsCard: React.FC<EmployeeDetailsCardProps> = ({
  employee,
}) => {
  const leaveCategories: LeaveCategory[] = [
    {
      label: "Sick Leave",
      value: employee.sickLeave,
      totalAllowance: 15,
      icon: Heart,
      tone: "rose",
    },
    {
      label: "Certificate Sick Leave",
      value: employee.certificateSickLeave,
      totalAllowance: 15,
      icon: FileText,
      tone: "rose",
    },
    {
      label: "Annual Leave",
      value: employee.annualLeave,
      totalAllowance: 30,
      icon: Calendar,
      tone: "teal",
    },
    {
      label: "Family Related Leave",
      value: employee.familyRelatedLeave,
      totalAllowance: 10,
      icon: Users,
      tone: "emerald",
    },
    {
      label: "Pre-Maternity Leave",
      value: employee.preMaternityLeave,
      icon: Heart,
      tone: "amber",
    },
    {
      label: "Maternity Leave",
      value: employee.maternityLeave,
      icon: Baby,
      tone: "amber",
    },
    {
      label: "Paternity Leave",
      value: employee.paternityLeave,
      icon: Baby,
      tone: "teal",
    },
    {
      label: "No Pay Leave",
      value: employee.noPayLeave,
      icon: DollarSign,
      tone: "rose",
    },
    {
      label: "Official Leave",
      value: employee.officialLeave,
      icon: Award,
      tone: "emerald",
    },
  ];

  return (
    <div className="space-y-6">
      <CouncilCard interactive="none" className="overflow-hidden p-0">
        <div className="h-24 bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500" />
        <div className="relative px-6 pb-6 pt-0 sm:px-8 sm:pb-8">
          <div className="-mt-12 mb-5">
            <AvatarGlow
              name={employee.name}
              size="lg"
              className="h-24 w-24 rounded-3xl text-3xl"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className={cn(typography.pageTitle, "text-3xl sm:text-4xl")}>
                {employee.name}
              </h2>
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 ring-1 ring-slate-200/80">
                <Briefcase className="h-4 w-4 text-slate-500" aria-hidden />
                <span className="text-sm font-semibold text-slate-700">
                  {employee.designation}
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-3 rounded-xl bg-teal-50 px-4 py-3 ring-1 ring-teal-100">
              <Calendar className="h-5 w-5 text-teal-600" aria-hidden />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Joined
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {formatDate(employee.joinedDate)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CouncilCard>

      <CouncilCard interactive="none" className="p-0">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="council-page-icon h-11 w-11">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className={typography.heading}>Leave Breakdown</h3>
              <p className={typography.body}>
                Detailed overview of all leave types
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
          {leaveCategories.map((category) => {
            const Icon = category.icon;
            const tone = statTones[category.tone];
            const isDeductible = category.totalAllowance !== undefined;
            const usedDays = isDeductible
              ? category.totalAllowance! - category.value
              : category.value;
            const remainingDays = isDeductible ? category.value : null;
            const consumptionPercent = isDeductible
              ? category.totalAllowance! > 0
                ? Math.round((usedDays / category.totalAllowance!) * 100)
                : 0
              : null;

            return (
              <div
                key={category.label}
                className={cn(
                  "rounded-2xl border border-slate-200/80 p-5 ring-1 ring-slate-200/50",
                  tone.light,
                )}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
                    <Icon className={cn("h-5 w-5", tone.label)} aria-hidden />
                  </div>

                  {isDeductible ? (
                    <div className="text-right">
                      <div className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-slate-900 shadow-sm ring-1 ring-slate-200/80">
                        {remainingDays} / {category.totalAllowance}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        {usedDays} used
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-white px-3 py-1.5 text-sm font-black text-slate-900 shadow-sm ring-1 ring-slate-200/80">
                      {usedDays} days
                    </div>
                  )}
                </div>

                <h4 className={cn("mb-3 text-sm font-black", tone.label)}>
                  {category.label}
                </h4>

                {isDeductible ? (
                  <>
                    <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/90 ring-1 ring-slate-200/60">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${consumptionPercent}%`,
                          background: `linear-gradient(90deg, ${tone.from}, ${tone.to})`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600">
                        {consumptionPercent}% consumed
                      </p>
                      {consumptionPercent === 100 ? (
                        <span className="text-xs font-bold text-rose-600">
                          All used
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-slate-600">
                    Incremental type
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CouncilCard>
    </div>
  );
};

export default EmployeeDetailsCard;
