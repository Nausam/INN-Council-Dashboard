"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { withTimestamps } from "@/lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";

export async function reviewOvertimeRequest(
  requestId: string,
  status: "Approved" | "Rejected",
): Promise<void> {
  const profile = await requireAdmin();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid OT request");
  if (status !== "Approved" && status !== "Rejected") throw new Error("Invalid OT status");
  const ref = getFirestoreDb().collection(COLLECTIONS.overtimeRequests).doc(requestId);
  if (!(await ref.get()).exists) throw new Error("OT request not found");
  await ref.update(withTimestamps({
    approvalStatus: status,
    actionBy: profile.fullName || profile.email,
  }));
}
