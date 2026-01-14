import React from "react";
import { useRouter } from "next/navigation";
import { Edit3, ChevronRight, Briefcase } from "lucide-react";
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

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    router.push(`/employees/${employeeId}/edit`);
  };

  // Generate a consistent color based on the first letter of name
  const getColorFromName = (name: string) => {
    const colors = [
      {
        bg: "bg-indigo-100",
        text: "text-indigo-700",
        border: "border-indigo-200",
      },
      {
        bg: "bg-violet-100",
        text: "text-violet-700",
        border: "border-violet-200",
      },
      {
        bg: "bg-purple-100",
        text: "text-purple-700",
        border: "border-purple-200",
      },
      {
        bg: "bg-fuchsia-100",
        text: "text-fuchsia-700",
        border: "border-fuchsia-200",
      },
      { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
      { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
      { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200" },
      { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200" },
      { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
      {
        bg: "bg-emerald-100",
        text: "text-emerald-700",
        border: "border-emerald-200",
      },
      { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-200" },
      {
        bg: "bg-green-100",
        text: "text-green-700",
        border: "border-green-200",
      },
      { bg: "bg-lime-100", text: "text-lime-700", border: "border-lime-200" },
      {
        bg: "bg-amber-100",
        text: "text-amber-700",
        border: "border-amber-200",
      },
      {
        bg: "bg-orange-100",
        text: "text-orange-700",
        border: "border-orange-200",
      },
    ];

    const firstChar = name.charAt(0).toUpperCase();
    const index = firstChar.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const colorScheme = getColorFromName(name);

  // Get section badge color
  const getSectionColor = (section?: string) => {
    if (!section) return "bg-slate-100 text-slate-600";

    switch (section.toLowerCase()) {
      case "councillor":
        return "bg-purple-100 text-purple-700";
      case "admin":
        return "bg-blue-100 text-blue-700";
      case "mosque":
        return "bg-emerald-100 text-emerald-700";
      case "waste management":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:border-slate-300 cursor-pointer"
    >
      {/* Ambient glow on hover */}
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-indigo-100/30 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />

      {/* Header with avatar and edit button */}
      <div className="relative mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colorScheme.bg} ${colorScheme.text} border ${colorScheme.border} text-lg font-bold shadow-sm transition-transform group-hover:scale-105`}
          >
            {initial}
          </div>

          {/* Name and designation */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              {name}
            </h3>
            <p className="text-sm text-slate-600 truncate">{designation}</p>
          </div>
        </div>

        {/* Edit button - only show for admins */}
        {isAdmin && (
          <button
            onClick={handleEditClick}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 hover:shadow"
            aria-label="Edit employee"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Section badge */}
      {section && (
        <div className="mb-3 flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-slate-400" />
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getSectionColor(
              section
            )}`}
          >
            {section}
          </span>
        </div>
      )}

      {/* View details indicator */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-xs font-medium text-slate-500">View details</span>
        <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-indigo-600" />
      </div>
    </div>
  );
};

export default EmployeeCard;
