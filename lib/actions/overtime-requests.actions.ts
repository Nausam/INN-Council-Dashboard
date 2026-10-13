"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { requireRequestReviewer } from "@/lib/auth/request-approvers";
import { withTimestamps } from "@/lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";

export async function reviewOvertimeRequest(
  requestId: string,
  status: "Approved" | "Rejected",
): Promise<void> {
  const reviewer = await requireRequestReviewer();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid OT request");
  if (status !== "Approved" && status !== "Rejected") throw new Error("Invalid OT status");
  const ref = getFirestoreDb().collection(COLLECTIONS.overtimeRequests).doc(requestId);
  if (!(await ref.get()).exists) throw new Error("OT request not found");
  await ref.update(withTimestamps({
    approvalStatus: status,
    actionBy: reviewer.name,
  }));
}

/** Removes an OT request. Approval doesn't change attendance or pay, so nothing else needs undoing. */
export async function deleteOvertimeRequest(requestId: string): Promise<void> {
  await requireAdmin();
  if (!/^[\w-]{1,128}$/.test(requestId)) throw new Error("Invalid OT request");
  await getFirestoreDb().collection(COLLECTIONS.overtimeRequests).doc(requestId).delete();
}
