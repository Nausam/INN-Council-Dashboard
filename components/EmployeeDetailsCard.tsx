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
  TrendingUp,
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

  // Get initial for avatar
  const initial = employee.name?.charAt(0)?.toUpperCase() || "?";

  // Generate avatar color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      { from: "#6366f1", to: "#8b5cf6", shadow: "rgba(99, 102, 241, 0.4)" },
      { from: "#8b5cf6", to: "#a855f7", shadow: "rgba(139, 92, 246, 0.4)" },
      { from: "#ec4899", to: "#f43f5e", shadow: "rgba(236, 72, 153, 0.4)" },
      { from: "#10b981", to: "#059669", shadow: "rgba(16, 185, 129, 0.4)" },
      { from: "#f59e0b", to: "#d97706", shadow: "rgba(245, 158, 11, 0.4)" },
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const avatarColor = getAvatarColor(employee.name);

  // Leave categories with icons, colors, and allowances
  const leaveCategories = [
    {
      label: "Sick Leave",
      value: employee.sickLeave,
      totalAllowance: 15,
      icon: Heart,
      gradient: "from-red-500 to-rose-500",
      bgColor: "bg-gradient-to-br from-red-50 to-rose-50",
      textColor: "text-red-700",
      iconColor: "text-red-600",
      ringColor: "ring-red-200/50",
    },
    {
      label: "Certificate Sick Leave",
      value: employee.certificateSickLeave,
      totalAllowance: 15,
      icon: FileText,
      gradient: "from-rose-500 to-pink-500",
      bgColor: "bg-gradient-to-br from-rose-50 to-pink-50",
      textColor: "text-rose-700",
      iconColor: "text-rose-600",
      ringColor: "ring-rose-200/50",
    },
    {
      label: "Annual Leave",
      value: employee.annualLeave,
      totalAllowance: 30,
      icon: Calendar,
      gradient: "from-blue-500 to-cyan-500",
      bgColor: "bg-gradient-to-br from-blue-50 to-cyan-50",
      textColor: "text-blue-700",
      iconColor: "text-blue-600",
      ringColor: "ring-blue-200/50",
    },
    {
      label: "Family Related Leave",
      value: employee.familyRelatedLeave,
      totalAllowance: 10,
      icon: Users,
      gradient: "from-purple-500 to-violet-500",
      bgColor: "bg-gradient-to-br from-purple-50 to-violet-50",
      textColor: "text-purple-700",
      iconColor: "text-purple-600",
      ringColor: "ring-purple-200/50",
    },
    {
      label: "Pre-Maternity Leave",
      value: employee.preMaternityLeave,
      icon: Heart,
      gradient: "from-pink-500 to-fuchsia-500",
      bgColor: "bg-gradient-to-br from-pink-50 to-fuchsia-50",
      textColor: "text-pink-700",
      iconColor: "text-pink-600",
      ringColor: "ring-pink-200/50",
    },
    {
      label: "Maternity Leave",
      value: employee.maternityLeave,
      icon: Baby,
      gradient: "from-fuchsia-500 to-purple-500",
      bgColor: "bg-gradient-to-br from-fuchsia-50 to-purple-50",
      textColor: "text-fuchsia-700",
      iconColor: "text-fuchsia-600",
      ringColor: "ring-fuchsia-200/50",
    },
    {
      label: "Paternity Leave",
      value: employee.paternityLeave,
      icon: Baby,
      gradient: "from-cyan-500 to-teal-500",
      bgColor: "bg-gradient-to-br from-cyan-50 to-teal-50",
      textColor: "text-cyan-700",
      iconColor: "text-cyan-600",
      ringColor: "ring-cyan-200/50",
    },
    {
      label: "No Pay Leave",
      value: employee.noPayLeave,
      icon: DollarSign,
      gradient: "from-slate-500 to-gray-600",
      bgColor: "bg-gradient-to-br from-slate-50 to-gray-50",
      textColor: "text-slate-700",
      iconColor: "text-slate-600",
      ringColor: "ring-slate-200/50",
    },
    {
      label: "Official Leave",
      value: employee.officialLeave,
      icon: Award,
      gradient: "from-amber-500 to-orange-500",
      bgColor: "bg-gradient-to-br from-amber-50 to-orange-50",
      textColor: "text-amber-700",
      iconColor: "text-amber-600",
      ringColor: "ring-amber-200/50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="group relative overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-slate-200/50">
        {/* Gradient header background */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500">
          {/* Animated gradient orbs */}
          <div className="absolute right-0 top-0 h-48 w-48 translate-x-12 -translate-y-12 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute left-0 top-0 h-32 w-32 -translate-x-8 -translate-y-8 rounded-full bg-white/10 blur-2xl" />
        </div>

        <div className="relative px-8 pb-8 pt-24">
          {/* Avatar with glow */}
          <div className="relative mb-6 inline-block">
            <div
              className="absolute inset-0 rounded-3xl opacity-50 blur-2xl"
              style={{
                background: `linear-gradient(135deg, ${avatarColor.from}, ${avatarColor.to})`,
              }}
            />
            <div
              className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-3xl font-black shadow-2xl ring-4 ring-white"
              style={{
                background: `linear-gradient(135deg, ${avatarColor.from}, ${avatarColor.to})`,
                color: "white",
              }}
            >
              {initial}
            </div>
          </div>

          {/* Name and designation */}
          <div className="mb-6">
            <h2 className="mb-3 text-4xl font-black tracking-tight text-slate-900">
              {employee.name}
            </h2>
            <div className="inline-flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-2.5 ring-1 ring-slate-200/50">
              <Briefcase className="h-5 w-5 text-slate-600" />
              <span className="text-sm font-bold text-slate-700">
                {employee.designation}
              </span>
            </div>
          </div>

          {/* Joined date with icon */}
          <div className="inline-flex items-center gap-3 rounded-2xl bg-indigo-50 px-4 py-2.5 ring-1 ring-indigo-200/50">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Joined
              </span>
              <p className="text-sm font-bold text-indigo-900">
                {formatDate(employee.joinedDate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Breakdown */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200/50">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">
                Leave Breakdown
              </h3>
              <p className="text-sm font-medium text-slate-600">
                Detailed overview of all leave types
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {leaveCategories.map((category, index) => {
              const Icon = category.icon;
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
                  key={index}
                  className={`group/item relative overflow-hidden rounded-2xl ${category.bgColor} p-6 ring-1 ${category.ringColor} transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
                  style={{
                    animation: `fadeInUp 400ms ease-out ${index * 50}ms both`,
                  }}
                >
                  {/* Shimmer effect */}
                  <div
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover/item:translate-x-full"
                    style={{ width: "50%" }}
                  />

                  {/* Header */}
                  <div className="relative mb-4 flex items-start justify-between">
                    {/* Icon */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-black/5 transition-all duration-300 group-hover/item:scale-110">
                      <Icon className={`h-6 w-6 ${category.iconColor}`} />
                    </div>

                    {/* Stats */}
                    {isDeductible ? (
                      <div className="text-right">
                        <div
                          className={`rounded-xl px-3 py-1.5 text-xs font-black ${category.textColor} bg-white shadow-md ring-1 ring-black/5`}
                        >
                          {remainingDays} / {category.totalAllowance}
                        </div>
                        <div className="mt-1.5 text-xs font-semibold text-slate-600">
                          {usedDays} used
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-xl px-3 py-1.5 text-sm font-black ${category.textColor} bg-white shadow-md ring-1 ring-black/5`}
                      >
                        {usedDays} days
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <h4
                    className={`relative mb-3 text-sm font-black ${category.textColor}`}
                  >
                    {category.label}
                  </h4>

                  {/* Progress bar */}
                  {isDeductible ? (
                    <>
                      <div className="relative mb-2 h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${category.gradient} shadow-sm transition-all duration-700`}
                          style={{
                            width: `${consumptionPercent}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-600">
                          {consumptionPercent}% consumed
                        </p>
                        {consumptionPercent === 100 && (
                          <span className="flex items-center gap-1 text-xs font-black text-red-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                            All used
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <p className="text-xs font-semibold text-slate-600">
                        Incremental type
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeeDetailsCard;
