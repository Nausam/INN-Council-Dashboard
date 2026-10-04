import { Clock3, HeartPulse, TreePalm, UsersRound, type LucideIcon } from "lucide-react";
import type { GlossTone } from "@/lib/employees/leave-visuals";

export type RequestKind = "salaam" | "family" | "annual" | "ot";

/**
 * One icon and color per request type, shared by the request cards, request
 * history and request forms. Colors match the leave types they file under
 * (Salaam is sick leave, so it's peach like sick leave elsewhere).
 */
export const REQUEST_VISUALS: Record<RequestKind, { icon: LucideIcon; tone: GlossTone }> = {
  salaam: { icon: HeartPulse, tone: "late" },
  family: { icon: UsersRound, tone: "present" },
  annual: { icon: TreePalm, tone: "leave" },
  ot: { icon: Clock3, tone: "annual" },
};
