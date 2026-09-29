import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fillAnnualLeaveTemplate } from "@/lib/forms/annual-leave";
import type { AnnualLeaveRequest } from "@/lib/actions/annual-leave.actions";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    if (!/^[\w-]{1,128}$/.test(params.id)) return new Response("Invalid request", { status: 400 });
    const snap = await getFirestoreDb().collection(COLLECTIONS.annualLeaveRequests).doc(params.id).get();
    if (!snap.exists) return new Response("Form not found", { status: 404 });
    const request = snap.data() as AnnualLeaveRequest;
    if (!request.takeover || !request.employeeNameDv || !request.submittedDate) {
      return new Response("This older request has no annual leave form data", { status: 404 });
    }
    const bytes = await fillAnnualLeaveTemplate(request);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Annual-Leave-${params.id}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return new Response("Unable to download annual leave form", { status: adminErrorStatus(error) });
  }
}
