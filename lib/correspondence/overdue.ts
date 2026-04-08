import { startOfDay } from "date-fns";

import type { CorrespondenceDoc } from "@/types/correspondence";

/** Overdue when still pending and due date is before start of today (local). */
export function isCorrespondenceOverdue(
  doc: Pick<CorrespondenceDoc, "dueAt" | "status">,
  now = new Date(),
): boolean {
  if (doc.status !== "pending" || !doc.dueAt) return false;
  return startOfDay(new Date(doc.dueAt)) < startOfDay(now);
}
