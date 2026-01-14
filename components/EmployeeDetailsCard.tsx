import React from "react";
import {
  Calendar,
  Briefcase,
  Award,
  Heart,
  Baby,
  Users,
  DollarSign,
  FileText,
} from "lucide-react";

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

const EmployeeDetailsCard: React.FC<EmployeeDetailsCardProps> = ({
  employee,
}) => {
  // Format the joined date
  const formatDate = (dateString: string) => {
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
  };

  // Calculate total leave days
  const totalLeave =
    employee.sickLeave +
    employee.certificateSickLeave +
    employee.annualLeave +
    employee.familyRelatedLeave +
    employee.preMaternityLeave +
    employee.maternityLeave +
    employee.paternityLeave +
    employee.noPayLeave +
    employee.officialLeave;

  // Get initial for avatar
  const initial = employee.name?.charAt(0)?.toUpperCase() || "?";

  // Leave categories with icons, colors, and allowances
  // Types with totalAllowance: remaining decreases with use (deductible)
  // Types without totalAllowance: value increases with use (incremental)
  const leaveCategories = [
    {
      label: "Sick Leave",
      value: employee.sickLeave,
      totalAllowance: 15,
      icon: Heart,
      color: "from-red-500 to-rose-500",
      bgColor: "bg-red-50",
      textColor: "text-red-700",
      iconColor: "text-red-600",
    },
    {
      label: "Certificate Sick Leave",
      value: employee.certificateSickLeave,
      totalAllowance: 15,
      icon: FileText,
      color: "from-rose-500 to-pink-500",
      bgColor: "bg-rose-50",
      textColor: "text-rose-700",
      iconColor: "text-rose-600",
    },
    {
      label: "Annual Leave",
      value: employee.annualLeave,
      totalAllowance: 30,
      icon: Calendar,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
      iconColor: "text-blue-600",
    },
    {
      label: "Family Related Leave",
      value: employee.familyRelatedLeave,
      totalAllowance: 10,
      icon: Users,
      color: "from-purple-500 to-violet-500",
      bgColor: "bg-purple-50",
      textColor: "text-purple-700",
      iconColor: "text-purple-600",
    },
    {
      label: "Pre-Maternity Leave",
      value: employee.preMaternityLeave,
      icon: Heart,
      color: "from-pink-500 to-fuchsia-500",
      bgColor: "bg-pink-50",
      textColor: "text-pink-700",
      iconColor: "text-pink-600",
    },
    {
      label: "Maternity Leave",
      value: employee.maternityLeave,
      icon: Baby,
      color: "from-fuchsia-500 to-purple-500",
      bgColor: "bg-fuchsia-50",
      textColor: "text-fuchsia-700",
      iconColor: "text-fuchsia-600",
    },
    {
      label: "Paternity Leave",
      value: employee.paternityLeave,
      icon: Baby,
      color: "from-cyan-500 to-teal-500",
      bgColor: "bg-cyan-50",
      textColor: "text-cyan-700",
      iconColor: "text-cyan-600",
    },
    {
      label: "No Pay Leave",
      value: employee.noPayLeave,
      icon: DollarSign,
      color: "from-slate-500 to-gray-500",
      bgColor: "bg-slate-50",
      textColor: "text-slate-700",
      iconColor: "text-slate-600",
    },
    {
      label: "Official Leave",
      value: employee.officialLeave,
      icon: Award,
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-50",
      textColor: "text-amber-700",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Background gradient */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500" />

        {/* Decorative elements */}
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-white/10 blur-2xl" />

        <div className="relative px-6 pb-6 pt-20">
          {/* Avatar */}
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-indigo-600 shadow-lg ring-4 ring-white">
            {initial}
          </div>

          {/* Name and designation */}
          <div className="mb-4">
            <h2 className="text-3xl font-bold text-slate-900">
              {employee.name}
            </h2>
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
              <Briefcase className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">
                {employee.designation}
              </span>
            </div>
          </div>

          {/* Joined date */}
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">
              Joined on{" "}
              <span className="font-semibold">
                {formatDate(employee.joinedDate)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {/* <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">
                Total Leave Days
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {totalLeave}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
              <Calendar className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">
                Leave Categories
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {leaveCategories.filter((cat) => cat.value > 0).length}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
              <FileText className="h-6 w-6 text-violet-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">
                Most Used Leave
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {Math.max(...leaveCategories.map((c) => c.value)) === 0
                  ? "None"
                  : leaveCategories
                      .reduce((max, cat) => (cat.value > max.value ? cat : max))
                      .label.split(" ")[0]}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <Award className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div> */}

      {/* Leave Breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h3 className="text-xl font-bold text-slate-900">Leave Breakdown</h3>
          <p className="mt-1 text-sm text-slate-600">
            Detailed breakdown of all leave types
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leaveCategories.map((category, index) => {
              const Icon = category.icon;
              const isDeductible = category.totalAllowance !== undefined;

              // For deductible leaves: value is remaining, used = total - remaining
              // For incremental leaves: value is used directly
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
                  key={index}
                  className={`group/item relative overflow-hidden rounded-xl border border-slate-200 ${category.bgColor} p-5 transition-all hover:shadow-md`}
                >
                  {/* Icon */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                      <Icon className={`h-5 w-5 ${category.iconColor}`} />
                    </div>
                    {isDeductible ? (
                      <div className="text-right">
                        <div
                          className={`rounded-full px-3 py-1 text-xs font-bold ${category.textColor} bg-white shadow-sm`}
                        >
                          {remainingDays} / {category.totalAllowance} left
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {usedDays} used
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-full px-3 py-1 text-sm font-bold ${category.textColor} bg-white shadow-sm`}
                      >
                        {usedDays} days
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <h4 className={`text-sm font-semibold ${category.textColor}`}>
                    {category.label}
                  </h4>

                  {/* Progress bar */}
                  {isDeductible ? (
                    <>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/50">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${category.color} transition-all duration-500`}
                          style={{
                            width: `${consumptionPercent}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        {consumptionPercent}% consumed
                        {consumptionPercent === 100 && (
                          <span className="ml-1 font-semibold text-red-600">
                            • All used
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <div className="mt-3">
                      <p className="text-xs text-slate-600">
                        Incremental leave type
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsCard;
