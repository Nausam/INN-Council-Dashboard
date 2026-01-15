import React from "react";
import { useRouter } from "next/navigation";
import { Edit3, ChevronRight, Briefcase, ArrowRight } from "lucide-react";
import { useUser } from "@/Providers/UserProvider";

interface EmployeeCardProps {
  name: string;
  designation: string;
  section?: string;
  employeeId: string;
  onClick: () => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  name,
  designation,
  section,
  employeeId,
  onClick,
}) => {
  const router = useRouter();
  const { currentUser, isAdmin, loading: userLoading } = useUser();
  const [isHovered, setIsHovered] = React.useState(false);

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    router.push(`/employees/${employeeId}/edit`);
  };

  // Generate a consistent color based on the first letter of name
  const getColorFromName = (name: string) => {
    const colors = [
      {
        bg: "from-indigo-500 to-indigo-600",
        light: "bg-indigo-50",
        text: "text-indigo-700",
        glow: "rgba(99, 102, 241, 0.4)",
        solid: "#6366f1",
      },
      {
        bg: "from-violet-500 to-violet-600",
        light: "bg-violet-50",
        text: "text-violet-700",
        glow: "rgba(139, 92, 246, 0.4)",
        solid: "#8b5cf6",
      },
      {
        bg: "from-purple-500 to-purple-600",
        light: "bg-purple-50",
        text: "text-purple-700",
        glow: "rgba(168, 85, 247, 0.4)",
        solid: "#a855f7",
      },
      {
        bg: "from-fuchsia-500 to-fuchsia-600",
        light: "bg-fuchsia-50",
        text: "text-fuchsia-700",
        glow: "rgba(217, 70, 239, 0.4)",
        solid: "#d946ef",
      },
      {
        bg: "from-pink-500 to-pink-600",
        light: "bg-pink-50",
        text: "text-pink-700",
        glow: "rgba(236, 72, 153, 0.4)",
        solid: "#ec4899",
      },
      {
        bg: "from-rose-500 to-rose-600",
        light: "bg-rose-50",
        text: "text-rose-700",
        glow: "rgba(244, 63, 94, 0.4)",
        solid: "#f43f5e",
      },
      {
        bg: "from-cyan-500 to-cyan-600",
        light: "bg-cyan-50",
        text: "text-cyan-700",
        glow: "rgba(6, 182, 212, 0.4)",
        solid: "#06b6d4",
      },
      {
        bg: "from-sky-500 to-sky-600",
        light: "bg-sky-50",
        text: "text-sky-700",
        glow: "rgba(14, 165, 233, 0.4)",
        solid: "#0ea5e9",
      },
      {
        bg: "from-blue-500 to-blue-600",
        light: "bg-blue-50",
        text: "text-blue-700",
        glow: "rgba(59, 130, 246, 0.4)",
        solid: "#3b82f6",
      },
      {
        bg: "from-emerald-500 to-emerald-600",
        light: "bg-emerald-50",
        text: "text-emerald-700",
        glow: "rgba(16, 185, 129, 0.4)",
        solid: "#10b981",
      },
      {
        bg: "from-teal-500 to-teal-600",
        light: "bg-teal-50",
        text: "text-teal-700",
        glow: "rgba(20, 184, 166, 0.4)",
        solid: "#14b8a6",
      },
      {
        bg: "from-green-500 to-green-600",
        light: "bg-green-50",
        text: "text-green-700",
        glow: "rgba(34, 197, 94, 0.4)",
        solid: "#22c55e",
      },
      {
        bg: "from-lime-500 to-lime-600",
        light: "bg-lime-50",
        text: "text-lime-700",
        glow: "rgba(132, 204, 22, 0.4)",
        solid: "#84cc16",
      },
      {
        bg: "from-amber-500 to-amber-600",
        light: "bg-amber-50",
        text: "text-amber-700",
        glow: "rgba(245, 158, 11, 0.4)",
        solid: "#f59e0b",
      },
      {
        bg: "from-orange-500 to-orange-600",
        light: "bg-orange-50",
        text: "text-orange-700",
        glow: "rgba(249, 115, 22, 0.4)",
        solid: "#f97316",
      },
    ];

    const firstChar = name.charAt(0).toUpperCase();
    const index = firstChar.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const colorScheme = getColorFromName(name);

  // Get section badge color
  const getSectionStyle = (section?: string) => {
    if (!section)
      return {
        bg: "bg-slate-100",
        text: "text-slate-600",
        icon: "text-slate-400",
      };

    switch (section.toLowerCase()) {
      case "councillor":
        return {
          bg: "bg-purple-100",
          text: "text-purple-700",
          icon: "text-purple-500",
        };
      case "admin":
        return {
          bg: "bg-blue-100",
          text: "text-blue-700",
          icon: "text-blue-500",
        };
      case "mosque":
        return {
          bg: "bg-emerald-100",
          text: "text-emerald-700",
          icon: "text-emerald-500",
        };
      case "waste management":
        return {
          bg: "bg-amber-100",
          text: "text-amber-700",
          icon: "text-amber-500",
        };
      default:
        return {
          bg: "bg-slate-100",
          text: "text-slate-600",
          icon: "text-slate-400",
        };
    }
  };

  const sectionStyle = getSectionStyle(section);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-md ring-1 ring-slate-200/50 backdrop-blur-xl transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-xl hover:ring-slate-300/50 cursor-pointer"
      style={{
        willChange: "transform",
      }}
    >
      {/* Decorative gradient orb */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-3xl transition-all duration-500 group-hover:opacity-20"
        style={{ background: colorScheme.solid }}
      />

      {/* Shimmer effect on hover */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
        style={{ width: "50%" }}
      />

      {/* Header with avatar and edit button */}
      <div className="relative mb-5 flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar with gradient and glow */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-2xl opacity-0 blur-xl transition-all duration-300 group-hover:opacity-50"
              style={{ background: colorScheme.solid }}
            />
            <div
              className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorScheme.bg} text-white text-lg font-black shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}
              style={{
                boxShadow: `0 8px 16px -4px ${colorScheme.glow}`,
              }}
            >
              {initial}
            </div>
          </div>

          {/* Name and designation */}
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 truncate text-lg font-black tracking-tight text-slate-900 transition-colors duration-200 group-hover:text-indigo-600">
              {name}
            </h3>
            <p className="truncate text-sm font-semibold text-slate-500">
              {designation}
            </p>
          </div>
        </div>

        {/* Edit button - only show for admins */}
        {isAdmin && (
          <button
            onClick={handleEditClick}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 hover:shadow-md"
            aria-label="Edit employee"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Section badge */}
      {section && (
        <div className="mb-4">
          <div
            className={`inline-flex items-center gap-2 rounded-xl ${sectionStyle.bg} px-3 py-2 shadow-sm ring-1 ring-black/5 transition-all duration-200 group-hover:scale-105`}
          >
            <Briefcase className={`h-3.5 w-3.5 ${sectionStyle.icon}`} />
            <span className={`text-xs font-bold ${sectionStyle.text}`}>
              {section}
            </span>
          </div>
        </div>
      )}

      {/* View details footer */}
      <div className="relative flex items-center justify-between rounded-xl bg-slate-50/50 px-4 py-3 ring-1 ring-slate-200/50 transition-all duration-200 group-hover:bg-indigo-50/50 group-hover:ring-indigo-200/50">
        <span className="text-xs font-bold text-slate-600 transition-colors duration-200 group-hover:text-indigo-600">
          View Profile
        </span>
        <div className="flex items-center gap-1">
          <ArrowRight className="h-4 w-4 text-slate-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-indigo-600" />
        </div>
      </div>

      {/* Active indicator dot */}
      <div
        className="absolute right-4 top-4 h-2 w-2 rounded-full opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100"
        style={{
          background: colorScheme.solid,
          boxShadow: `0 0 8px ${colorScheme.glow}`,
        }}
      >
        <div
          className="h-full w-full animate-ping rounded-full"
          style={{ background: colorScheme.solid }}
        />
      </div>
    </div>
  );
};

export default EmployeeCard;
