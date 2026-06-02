import {
  fetchEmployeeByRecordCardNumber,
  upsertSalarySlipRecord,
} from "@/lib/firebase/hr";
import { isR2Configured, uploadToR2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPE = "application/pdf";

function sanitizePeriodForKey(period: string): string {
  return period.replace(/[^\w\-.]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "slip";
}

export async function POST(request: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          error: "File storage is not configured",
          detail:
            "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in the environment.",
          code: "R2_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const recordCardNumber = formData.get("recordCardNumber") as string | null;
    const periodLabel = formData.get("periodLabel") as string | null;

    const trimmedRecord =
      typeof recordCardNumber === "string" ? recordCardNumber.trim() : "";
    const trimmedPeriod =
      typeof periodLabel === "string" ? periodLabel.trim() : "";

    if (!trimmedRecord) {
      return NextResponse.json(
        {
          error: "Employee is required",
          detail: "Select an employee from the list.",
          code: "EMPLOYEE_REQUIRED",
        },
        { status: 400 },
      );
    }
    if (!trimmedPeriod) {
      return NextResponse.json(
        {
          error: "Salary period is required",
          detail: "Choose a month and year before uploading.",
          code: "PERIOD_REQUIRED",
        },
        { status: 400 },
      );
    }
    if (!/^\d{4}-\d{2}$/.test(trimmedPeriod)) {
      return NextResponse.json(
        {
          error: "Invalid salary period format",
          detail: `Expected YYYY-MM, received "${trimmedPeriod}".`,
          code: "PERIOD_INVALID",
        },
        { status: 400 },
      );
    }
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        {
          error: "PDF file is required",
          detail: "Choose a salary slip PDF to upload.",
          code: "FILE_MISSING",
        },
        { status: 400 },
      );
    }
    if (file.type !== ALLOWED_TYPE && !/\.pdf$/i.test(file.name)) {
      return NextResponse.json(
        {
          error: "Only PDF files are allowed",
          detail: `"${file.name}" is not a PDF.`,
          code: "NOT_PDF",
        },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "PDF file is too large",
          detail: `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum size is 10 MB.`,
          code: "FILE_TOO_LARGE",
        },
        { status: 400 },
      );
    }

    const employee = await fetchEmployeeByRecordCardNumber(trimmedRecord);
    if (!employee) {
      return NextResponse.json(
        {
          error: "Employee not found",
          detail: `No employee exists with record card ${trimmedRecord}.`,
          code: "EMPLOYEE_NOT_FOUND",
        },
        { status: 404 },
      );
    }
    const fileName = file.name || `${trimmedPeriod}.pdf`;
    const keySegment = sanitizePeriodForKey(trimmedPeriod);
    const objectKey = `slips/${trimmedRecord}/${keySegment}.pdf`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(objectKey, buffer, "application/pdf");

    const { doc, replacedExisting } = await upsertSalarySlipRecord({
      recordCardNumber: trimmedRecord,
      employeeId: employee.$id,
      periodLabel: trimmedPeriod,
      objectKey,
      fileName,
    });

    return NextResponse.json({
      success: true,
      id: doc.$id,
      objectKey,
      periodLabel: trimmedPeriod,
      recordCardNumber: trimmedRecord,
      replacedExisting,
    });
  } catch (error) {
    console.error("POST /api/salary-slips/upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload salary slip",
        detail:
          error instanceof Error && error.message.includes("R2")
            ? "Cloudflare R2 rejected the upload. Check R2 credentials and bucket permissions."
            : undefined,
        code: "UPLOAD_FAILED",
      },
      { status: 500 },
    );
  }
}
