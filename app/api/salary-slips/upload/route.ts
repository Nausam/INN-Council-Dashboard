import {
  createSalarySlipRecord,
  fetchEmployeeByRecordCardNumber,
} from "@/lib/appwrite/appwrite";
import { uploadToR2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPE = "application/pdf";

function sanitizePeriodForKey(period: string): string {
  return period.replace(/[^\w\-.]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "slip";
}

export async function POST(request: NextRequest) {
  try {
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
        { error: "Record card number is required" },
        { status: 400 }
      );
    }
    if (!trimmedPeriod) {
      return NextResponse.json(
        { error: "Period label is required (e.g. 2025-01 or January 2025)" },
        { status: 400 }
      );
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a PDF file" },
        { status: 400 }
      );
    }
    if (file.type !== ALLOWED_TYPE) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be 10MB or smaller" },
        { status: 400 }
      );
    }

    // Optional: verify employee exists
    const employee = await fetchEmployeeByRecordCardNumber(trimmedRecord);
    const fileName = file.name || `${trimmedPeriod}.pdf`;
    const keySegment = sanitizePeriodForKey(trimmedPeriod);
    const objectKey = `slips/${trimmedRecord}/${keySegment}.pdf`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(objectKey, buffer, "application/pdf");

    const doc = await createSalarySlipRecord({
      recordCardNumber: trimmedRecord,
      employeeId: employee?.$id,
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
    });
  } catch (error) {
    console.error("POST /api/salary-slips/upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload salary slip",
      },
      { status: 500 }
    );
  }
}
