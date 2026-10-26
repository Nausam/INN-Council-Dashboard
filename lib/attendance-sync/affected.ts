import { reconcileCouncilAttendanceDate } from "@/lib/attendance-sync/council";
import { reconcileMosqueAttendanceDate } from "@/lib/attendance-sync/reconcile";

/**
 * Dates whose punches changed, with the employees whose sheets need
 * reconciling (null: everyone on that date). Reconciling only those employees
 * keeps one new punch from re-reading the whole staff's punches and rows.
 */
export type AffectedAttendance = Map<string, Set<string> | null>;

export function markAffected(
  affected: AffectedAttendance,
  date: string,
  employeeIds: Array<string | null | undefined> | "all",
): void {
  if (employeeIds === "all") {
    affected.set(date, null);
    return;
  }
  const ids = employeeIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;
  const current = affected.get(date);
  if (current === null) return;
  const set = current ?? new Set<string>();
  for (const id of ids) set.add(id);
  affected.set(date, set);
}

export async function reconcileAffected(affected: AffectedAttendance): Promise<void> {
  for (const [date, ids] of affected) {
    const employeeIds = ids ? Array.from(ids) : undefined;
    await reconcileMosqueAttendanceDate(date, employeeIds, { preview: false });
    await reconcileCouncilAttendanceDate(date, { preview: false, ensureToday: true, employeeIds });
  }
}
