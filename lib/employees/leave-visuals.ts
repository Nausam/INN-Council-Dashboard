import {
  Baby,
  Ban,
  BriefcaseBusiness,
  CalendarDays,
  Stethoscope,
  Thermometer,
  TreePalm,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/** Color families used by the employee portal's glossy tiles and calendar pages. */
export type GlossTone = "present" | "late" | "leave" | "annual" | "pending" | "neutral";

/** Each leave type keeps one icon and color everywhere it appears. */
const LEAVE_VISUALS: Record<string, { icon: LucideIcon; tone: GlossTone }> = {
  sickLeave: { icon: Thermometer, tone: "late" },
  certificateSickLeave: { icon: Stethoscope, tone: "annual" },
  annualLeave: { icon: TreePalm, tone: "leave" },
  familyRelatedLeave: { icon: UsersRound, tone: "present" },
  preMaternityLeave: { icon: Baby, tone: "annual" },
  maternityLeave: { icon: Baby, tone: "late" },
  paternityLeave: { icon: Baby, tone: "leave" },
  noPayLeave: { icon: Ban, tone: "late" },
  officialLeave: { icon: BriefcaseBusiness, tone: "present" },
};

export function leaveVisual(leaveType: string): { icon: LucideIcon; tone: GlossTone } {
  return LEAVE_VISUALS[leaveType] ?? { icon: CalendarDays, tone: "leave" };
}
