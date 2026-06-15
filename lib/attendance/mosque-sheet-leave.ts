import { reverseLeaveTypeMapping } from "@/constants";
import type { MosqueAttendanceDoc } from "@/lib/firebase/types";
import type { ImamOptionKey } from "@/lib/attendance/mosque-sign-sheet-config";

export const IMAM_RECORD_CARDS: Partial<Record<ImamOptionKey, string>> = {
  Shahidh: "A105751",
  Zahidh: "A104244",
  Umair: "T4650904",
};

export const LEAVE_LABEL_DHIVEHI: Record<string, string> = {
  "Sick Leave": "ސެޓިފިކެޓް ސަލާމް",
  "Certificate Leave": "ސެޓިފިކެޓް ސަލާމް",
  "Annual Leave": "އަހަރީ ޗުއްޓީ",
  "Family Related Leave": "އާއިލީ ޒިންމާ",
  "Maternity Leave": "މެޓާނިޓީ ލީވް",
  "Pre Maternity Leave": "މެޓާނިޓީ ލީވް",
  "Paternity Leave": "ޕެޓާނިޓީ ލީވް",
  "No Pay Leave": "ނޯޕޭ ލީވް",
  "Official Leave": "ރަސްމީ",
};

export function leaveLabelToDhivehi(label: string): string {
  return LEAVE_LABEL_DHIVEHI[label] ?? "އެހެނިހެން";
}

export function buildLeaveByIso(
  records: MosqueAttendanceDoc[],
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const rec of records) {
    const leaveType = rec.leaveType?.trim();
    if (!leaveType) continue;

    const iso = String(rec.date ?? "").slice(0, 10);
    if (!iso) continue;

    map[iso] = reverseLeaveTypeMapping[leaveType] ?? leaveType;
  }

  return map;
}

export function buildLeaveByDay(
  records: MosqueAttendanceDoc[],
  year: number,
  month0: number,
): Record<number, string> {
  const monthPrefix = `${year}-${String(month0 + 1).padStart(2, "0")}`;
  const map: Record<number, string> = {};

  for (const rec of records) {
    const leaveType = rec.leaveType?.trim();
    if (!leaveType) continue;

    const iso = String(rec.date ?? "").slice(0, 10);
    if (!iso.startsWith(monthPrefix)) continue;

    const day = Number(iso.slice(8, 10));
    if (!Number.isFinite(day)) continue;

    map[day] = reverseLeaveTypeMapping[leaveType] ?? leaveType;
  }

  return map;
}

export function imamRecordCard(imamKey: ImamOptionKey): string {
  return IMAM_RECORD_CARDS[imamKey]?.trim() ?? "";
}
