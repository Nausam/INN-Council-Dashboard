import { NextResponse, type NextRequest } from "next/server";

import { hasEmployeeProfileAccess } from "@/lib/auth/employee-profile-session";
import { EMPLOYEE_PHOTO_PREFIX } from "@/lib/employees/photo";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { getPresignedViewUrl, isR2Configured } from "@/lib/r2";

/**
 * Serves an employee's profile photo to admins and to that employee's own
 * Employee Profile session, by redirecting to a short-lived R2 URL.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { employeeId: string } },
) {
  const { employeeId } = params;
  if (!(await hasEmployeeProfileAccess(employeeId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "File storage is not configured" }, { status: 503 });
  }

  const snap = await getFirestoreDb().collection(COLLECTIONS.employees).doc(employeeId).get();
  const photoKey = snap.get("photoKey");
  if (typeof photoKey !== "string" || !photoKey.startsWith(`${EMPLOYEE_PHOTO_PREFIX}${employeeId}/`)) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }

  try {
    const response = NextResponse.redirect(await getPresignedViewUrl(photoKey, 3600));
    // The URL carries the photo version, so the browser may reuse it briefly.
    response.headers.set("Cache-Control", "private, max-age=600");
    return response;
  } catch (error) {
    console.error("Employee photo URL error:", error);
    return NextResponse.json({ error: "Could not load photo" }, { status: 500 });
  }
}
