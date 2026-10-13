import "server-only";

import { getEmployeeProfileSessionId } from "@/lib/auth/employee-profile-session";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { LEAVE_SUPERVISORS } from "@/lib/leave/supervisors";

/**
 * Employees who can review requests from the Employee Profile app, besides
 * the leave supervisors: matched by ID card number.
 */
const EXTRA_APPROVER_ID_CARDS = new Set(["A241196"]);

export type RequestApprover = {
  employeeId: string;
  name: string;
};

export type RequestReviewer = {
  name: string;
  email?: string;
  /** Set when the reviewer is an employee signed in to the Employee Profile app. */
  employeeId?: string;
};

/** The signed-in Employee Profile user, when they may review employee requests. */
export async function getRequestApprover(): Promise<RequestApprover | null> {
  const employeeId = getEmployeeProfileSessionId();
  if (!employeeId) return null;
  const snap = await getFirestoreDb().collection(COLLECTIONS.employees).doc(employeeId).get();
  if (!snap.exists) return null;
  const employee = snap.data() ?? {};
  const supervisor = LEAVE_SUPERVISORS.find((item) => item.employeeId === employeeId);
  const idCards = [employee.idCardNumber, employee.idCard, employee.nationalId, employee.nationalIdCard]
    .map((value) => String(value ?? "").trim().toUpperCase());
  if (!supervisor && !idCards.some((value) => EXTRA_APPROVER_ID_CARDS.has(value))) return null;
  return {
    employeeId,
    name: typeof employee.name === "string" && employee.name.trim() ? employee.name.trim() : supervisor?.label ?? "Approver",
  };
}

/** An admin (Clerk) or an approver signed in to the Employee Profile app. */
export async function requireRequestReviewer(): Promise<RequestReviewer> {
  const profile = await getSessionAuthProfile();
  if (profile?.isAdmin) return { name: profile.fullName || profile.email, email: profile.email };
  const approver = await getRequestApprover();
  if (approver) return { name: approver.name, employeeId: approver.employeeId };
  throw new Error(profile ? "Forbidden" : "Unauthorized");
}
