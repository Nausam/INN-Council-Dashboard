import { reverseLeaveTypeMapping } from "@/constants";

/** Council Dashboard design tokens — single source of truth for brand + semantic accents */

export const councilBrand = {
  primary: "#0d9488",
  primaryHover: "#0f766e",
  primaryLight: "#ccfbf1",
  primaryMuted: "#14b8a6",
  foreground: "#134e4a",
  textSecondary: "#64748b",
} as const;

/** @deprecated Use councilBrand — kept for auth imports */
export const authBrand = councilBrand;

export type AvatarAccent = {
  id: string;
  from: string;
  to: string;
  glow: string;
  solid: string;
  light: string;
  text: string;
};

export const avatarAccents: AvatarAccent[] = [
  {
    id: "rose",
    from: "#f43f5e",
    to: "#e11d48",
    glow: "rgba(244, 63, 94, 0.35)",
    solid: "#f43f5e",
    light: "bg-rose-50",
    text: "text-rose-700",
  },
  {
    id: "orange",
    from: "#f97316",
    to: "#ea580c",
    glow: "rgba(249, 115, 22, 0.35)",
    solid: "#f97316",
    light: "bg-orange-50",
    text: "text-orange-700",
  },
  {
    id: "amber",
    from: "#f59e0b",
    to: "#d97706",
    glow: "rgba(245, 158, 11, 0.35)",
    solid: "#f59e0b",
    light: "bg-amber-50",
    text: "text-amber-700",
  },
  {
    id: "teal",
    from: "#14b8a6",
    to: "#0d9488",
    glow: "rgba(20, 184, 166, 0.35)",
    solid: "#14b8a6",
    light: "bg-teal-50",
    text: "text-teal-700",
  },
  {
    id: "green",
    from: "#22c55e",
    to: "#16a34a",
    glow: "rgba(34, 197, 94, 0.35)",
    solid: "#22c55e",
    light: "bg-green-50",
    text: "text-green-700",
  },
  {
    id: "cyan",
    from: "#06b6d4",
    to: "#0891b2",
    glow: "rgba(6, 182, 212, 0.35)",
    solid: "#06b6d4",
    light: "bg-cyan-50",
    text: "text-cyan-700",
  },
  {
    id: "purple",
    from: "#a855f7",
    to: "#9333ea",
    glow: "rgba(168, 85, 247, 0.35)",
    solid: "#a855f7",
    light: "bg-purple-50",
    text: "text-purple-700",
  },
  {
    id: "violet",
    from: "#8b5cf6",
    to: "#7c3aed",
    glow: "rgba(139, 92, 246, 0.35)",
    solid: "#8b5cf6",
    light: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    id: "blue",
    from: "#3b82f6",
    to: "#2563eb",
    glow: "rgba(59, 130, 246, 0.35)",
    solid: "#3b82f6",
    light: "bg-blue-50",
    text: "text-blue-700",
  },
  {
    id: "emerald",
    from: "#10b981",
    to: "#059669",
    glow: "rgba(16, 185, 129, 0.35)",
    solid: "#10b981",
    light: "bg-emerald-50",
    text: "text-emerald-700",
  },
];

export type SectionBadgeStyle = {
  bg: string;
  text: string;
  icon: string;
};

export const sectionBadges: Record<string, SectionBadgeStyle> = {
  councillor: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    icon: "text-purple-500",
  },
  admin: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: "text-blue-500",
  },
  mosque: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    icon: "text-emerald-500",
  },
  "waste management": {
    bg: "bg-amber-100",
    text: "text-amber-700",
    icon: "text-amber-500",
  },
  default: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    icon: "text-slate-400",
  },
};

export function getAvatarAccent(name: string): AvatarAccent {
  const firstChar = name?.charAt(0)?.toUpperCase() || "?";
  const index = firstChar.charCodeAt(0) % avatarAccents.length;
  return avatarAccents[index]!;
}

export function getSectionBadgeStyle(section?: string): SectionBadgeStyle {
  if (!section) return sectionBadges.default;
  const key = section.toLowerCase();
  return sectionBadges[key] ?? sectionBadges.default;
}

export const radii = {
  card: "1.5rem",
  control: "0.75rem",
  avatar: "0.75rem",
  pill: "9999px",
} as const;

export const shadows = {
  card: "0 4px 24px -4px rgb(15 23 42 / 0.08)",
  cardHover: "0 12px 32px -8px rgb(15 23 42 / 0.12)",
  avatar: (glow: string) => `0 4px 14px -3px ${glow}`,
} as const;

export const motion = {
  duration: "220ms",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  interactive:
    "transition-[color,background-color,box-shadow,transform,opacity] duration-200 ease-out",
} as const;

export const pageBackground =
  "min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50";

export type StatTone = "teal" | "emerald" | "amber" | "rose";

export const statTones: Record<
  StatTone,
  { from: string; to: string; glow: string; light: string; label: string; value: string }
> = {
  teal: {
    from: "#14b8a6",
    to: "#0d9488",
    glow: "rgba(20, 184, 166, 0.3)",
    light: "bg-teal-50",
    label: "text-teal-700",
    value: "text-slate-900",
  },
  emerald: {
    from: "#10b981",
    to: "#059669",
    glow: "rgba(16, 185, 129, 0.3)",
    light: "bg-emerald-50",
    label: "text-emerald-700",
    value: "text-slate-900",
  },
  amber: {
    from: "#f59e0b",
    to: "#d97706",
    glow: "rgba(245, 158, 11, 0.3)",
    light: "bg-amber-50",
    label: "text-amber-700",
    value: "text-slate-900",
  },
  rose: {
    from: "#f43f5e",
    to: "#e11d48",
    glow: "rgba(244, 63, 94, 0.3)",
    light: "bg-rose-50",
    label: "text-rose-700",
    value: "text-slate-900",
  },
};

export const leaveTypeStyles: Record<
  string,
  { bg: string; text: string; pill: string }
> = {
  sick: { bg: "#ef4444", text: "Sick Leave", pill: "bg-red-100 text-red-700" },
  annual: { bg: "#3b82f6", text: "Annual Leave", pill: "bg-blue-100 text-blue-700" },
  vacation: { bg: "#3b82f6", text: "Annual Leave", pill: "bg-blue-100 text-blue-700" },
  family: { bg: "#f97316", text: "Family Leave", pill: "bg-orange-100 text-orange-700" },
  certificate: { bg: "#dc2626", text: "Certificate Leave", pill: "bg-red-100 text-red-800" },
  personal: { bg: "#8b5cf6", text: "Personal Leave", pill: "bg-purple-100 text-purple-700" },
  maternity: { bg: "#ec4899", text: "Maternity Leave", pill: "bg-pink-100 text-pink-700" },
  prematernity: {
    bg: "#f472b6",
    text: "Pre Maternity Leave",
    pill: "bg-pink-100 text-pink-700",
  },
  paternity: { bg: "#db2777", text: "Paternity Leave", pill: "bg-pink-100 text-pink-800" },
  nopay: { bg: "#64748b", text: "No Pay Leave", pill: "bg-slate-100 text-slate-700" },
  bereavement: { bg: "#475569", text: "Bereavement Leave", pill: "bg-slate-100 text-slate-800" },
  default: { bg: "#f43f5e", text: "On Leave", pill: "bg-rose-100 text-rose-700" },
  late: { bg: "#f59e0b", text: "Late", pill: "bg-amber-100 text-amber-800" },
};

const LEAVE_FIELD_STYLE_KEYS: Record<string, keyof typeof leaveTypeStyles> = {
  sickLeave: "sick",
  certificateSickLeave: "certificate",
  annualLeave: "annual",
  familyRelatedLeave: "family",
  maternityLeave: "maternity",
  preMaternityLeave: "prematernity",
  paternityLeave: "paternity",
  noPayLeave: "nopay",
  officialLeave: "default",
};

export function getLeaveTypeStyle(leaveType?: string | null) {
  if (!leaveType) return leaveTypeStyles.default;

  const styleKey = LEAVE_FIELD_STYLE_KEYS[leaveType];
  if (styleKey) {
    const style = leaveTypeStyles[styleKey];
    const label =
      typeof reverseLeaveTypeMapping[leaveType] === "string"
        ? reverseLeaveTypeMapping[leaveType]
        : style.text;
    return { ...style, text: label };
  }

  const type = leaveType.toLowerCase();
  if (type.includes("prematernity")) return leaveTypeStyles.prematernity;
  for (const [key, style] of Object.entries(leaveTypeStyles)) {
    if (
      key !== "default" &&
      key !== "late" &&
      key !== "prematernity" &&
      type.includes(key)
    ) {
      return style;
    }
  }
  return { ...leaveTypeStyles.default, text: leaveType, pill: "bg-rose-100 text-rose-700" };
}


export const typography = {
  heading: "text-lg font-black tracking-tight text-slate-900",
  body: "text-sm font-semibold text-slate-500",
  caption: "text-xs font-bold text-slate-600",
  pageTitle: "text-4xl font-bold tracking-tight text-slate-900",
  pageSubtitle: "mt-1 text-slate-600",
  sidebarOverline:
    "truncate text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700/70",
  sidebarTitle: "truncate text-sm font-black tracking-tight text-slate-900",
} as const;

/** Sidebar layout + surface classes aligned with council-card vocabulary */
export const sidebar = {
  widthExpanded: 280,
  widthCollapsed: 76,
  panel: "council-sidebar-panel relative flex h-full w-full flex-col overflow-hidden bg-white",
  header: "council-sidebar-header",
  footer: "council-sidebar-footer",
  brandIcon:
    "council-sidebar-brand-icon",
  navItem:
    "group relative flex w-full items-center gap-3 rounded-xl text-sm font-semibold text-slate-600 transition-[color,background-color,box-shadow,transform] duration-200 hover:bg-slate-50 hover:text-slate-900",
  navItemIconOnly: "justify-center px-0 py-2.5",
  navItemExpanded: "px-2.5 py-2",
  navItemActive:
    "bg-teal-50 text-teal-900 ring-1 ring-teal-100 shadow-sm shadow-teal-500/5",
  navIconWrap:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 transition-[background-color,transform] duration-200 group-hover:scale-[1.04] group-hover:bg-teal-50",
  navIconWrapActive: "bg-teal-100",
  navIcon: "h-[17px] w-[17px] shrink-0 text-slate-400 transition-colors duration-200 group-hover:text-teal-600",
  navIconActive: "text-teal-600",
  subnavBorder: "ml-4 mt-1.5 border-l-2 border-slate-200 pl-3",
  subnavItem:
    "group/sub flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition-[color,background-color] duration-200 hover:bg-slate-50 hover:text-slate-900",
  subnavItemActive: "bg-teal-50 font-semibold text-teal-800",
  userCard:
    "group flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-2.5 text-left shadow-sm ring-1 ring-slate-200/50 transition-[border-color,background-color,box-shadow,transform] duration-200 hover:border-teal-200 hover:bg-teal-50/40 hover:shadow-md hover:shadow-teal-500/5 active:scale-[0.99]",
  userCardIconOnly: "justify-center px-2",
  mobileHeader:
    "sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-sm md:hidden",
  mobileBrandIcon:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20 ring-1 ring-teal-100",
} as const;
