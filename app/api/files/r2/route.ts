import { NextRequest, NextResponse } from "next/server";
import { hasEmployeeProfileAccess } from "@/lib/auth/employee-profile-session";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchEmployeeByRecordCardNumber } from "@/lib/firebase/hr";

import {
  getPresignedDownloadUrl,
  getPresignedViewUrl,
  isR2Configured,
} from "@/lib/r2";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const mode = request.nextUrl.searchParams.get("mode") ?? "view";
  const filename = request.nextUrl.searchParams.get("filename") ?? undefined;

  if (!key?.trim()) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  if (key.startsWith("slips/")) {
    const slipDoc = await getFirestoreDb()
      .collection(COLLECTIONS.salarySlips)
      .where("objectKey", "==", key)
      .limit(1)
      .get();
    const slip = slipDoc.docs[0]?.data();
    const employeeId = typeof slip?.employeeId === "string" && slip.employeeId
      ? slip.employeeId
      : typeof slip?.recordCardNumber === "string"
        ? (await fetchEmployeeByRecordCardNumber(slip.recordCardNumber))?.$id
        : null;
    if (!employeeId || !(await hasEmployeeProfileAccess(employeeId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 is not configured" }, { status: 503 });
  }

  try {
    const url =
      mode === "download"
        ? await getPresignedDownloadUrl(key, filename)
        : await getPresignedViewUrl(key);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("R2 file proxy error:", error);
    return NextResponse.json({ error: "Failed to generate file URL" }, { status: 500 });
  }
}
