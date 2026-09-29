import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { getEmployeeProfileSessionId } from "@/lib/auth/employee-profile-session";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import type { AnnualLeaveRequest } from "@/lib/actions/annual-leave.actions";
import { createAnnualLeaveChitPdf } from "@/lib/forms/annual-leave-chit";
import { findAnnualLeaveEmployee } from "@/lib/leave/annual-employee";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const profile = await getSessionAuthProfile();
  const employeeSessionId = getEmployeeProfileSessionId();
  if (!profile && !employeeSessionId) return new Response("Unauthorized", { status: 401 });
  if (!/^[\w-]{1,128}$/.test(params.id)) return new Response("Invalid request", { status: 400 });
  const snap = await getFirestoreDb().collection(COLLECTIONS.annualLeaveRequests).doc(params.id).get();
  if (!snap.exists) return new Response("Chit not found", { status: 404 });
  const request = snap.data() as AnnualLeaveRequest;
  const sameSubmitter = Boolean(profile && request.submittedBy?.toLowerCase() === profile.email.toLowerCase());
  const sameEmployee = Boolean(profile && request.fullName?.trim().toLowerCase() === profile.fullName.trim().toLowerCase());
  if (!profile?.isAdmin && !sameSubmitter && !sameEmployee && request.employeeId !== employeeSessionId) {
    return new Response("Forbidden", { status: 403 });
  }
  if (request.approvalStatus !== "Approved" || !request.signatureReady || !request.approver) {
    return new Response("Leave chit is not available yet", { status: 404 });
  }
  try {
    const joinedDate = request.joinedDate || (await findAnnualLeaveEmployee(request))?.joinedDate;
    const bytes = await createAnnualLeaveChitPdf({ ...request, joinedDate });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Annual-Leave-Chit-${params.id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Unable to create leave chit", { status: 500 });
  }
}
