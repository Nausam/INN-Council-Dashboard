import {
  fetchAllEmployees,
  type EmployeeDoc,
  upsertSalarySlipRecord,
} from "@/lib/firebase/hr";
import {
  describeSlipMatchFailure,
  getSlipFileBaseName,
  matchEmployeeBySlipFileName,
  type SlipMatchEmployee,
} from "@/lib/salary-slips/matchSlipFileName";
import { isR2Configured, uploadToR2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPE = "application/pdf";
const MAX_FILES = 100;

function isPdfFile(file: File): boolean {
  if (file.type === ALLOWED_TYPE) return true;
  if (!file.type && /\.pdf$/i.test(file.name)) return true;
  return false;
}

function sanitizePeriodForKey(period: string): string {
  return period
    .replace(/[^\w\-.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "slip";
}

function toSlipEmployees(list: EmployeeDoc[]): SlipMatchEmployee[] {
  return list
    .map((employee) => {
      const id = employee.$id;
      const rc = employee.recordCardNumber;
      const recordCard = typeof rc === "string" ? rc.trim() : "";
      if (!recordCard || typeof id !== "string") return null;
      return {
        id,
        name: employee.name ?? "Unknown",
        recordCardNumber: recordCard,
      };
    })
    .filter((employee): employee is SlipMatchEmployee => employee !== null);
}

function getUploadableFiles(rawFiles: FormDataEntryValue[]): File[] {
  return rawFiles.filter((entry): entry is File => {
    if (!(entry instanceof File)) return false;
    return entry.size > 0 && Boolean(entry.name.trim());
  });
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
    const periodLabel = formData.get("periodLabel") as string | null;
    const trimmedPeriod =
      typeof periodLabel === "string" ? periodLabel.trim() : "";

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

    const files = getUploadableFiles(formData.getAll("files"));

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: "No PDF files were received",
          detail:
            "Select one or more PDF files. Empty files and non-PDF selections are ignored.",
          code: "FILES_MISSING",
        },
        { status: 400 },
      );
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        {
          error: `Too many files in one request (${files.length})`,
          detail: `Upload at most ${MAX_FILES} PDFs per batch.`,
          code: "FILES_LIMIT",
        },
        { status: 400 },
      );
    }

    const employees = toSlipEmployees(await fetchAllEmployees());
    if (employees.length === 0) {
      return NextResponse.json(
        {
          error: "No employees found",
          detail:
            "Add employees with record card numbers before uploading salary slips.",
          code: "EMPLOYEES_EMPTY",
        },
        { status: 400 },
      );
    }

    const keySegment = sanitizePeriodForKey(trimmedPeriod);

    type OkRow = {
      fileName: string;
      recordCardNumber: string;
      employeeName: string;
      objectKey: string;
      replacedExisting: boolean;
      matchMethod: string;
    };
    type ErrRow = {
      fileName: string;
      error: string;
      detail?: string;
      code?: string;
    };

    const ok: OkRow[] = [];
    const failed: ErrRow[] = [];

    for (const file of files) {
      const fileName = file.name || "unknown.pdf";
      const displayName = getSlipFileBaseName(fileName) || fileName;

      if (!isPdfFile(file)) {
        failed.push({
          fileName,
          error: `"${displayName}" is not a PDF`,
          detail: "Only .pdf files are accepted.",
          code: "NOT_PDF",
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        failed.push({
          fileName,
          error: `"${displayName}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
          detail: "Each PDF must be 10 MB or smaller.",
          code: "FILE_TOO_LARGE",
        });
        continue;
      }

      const match = matchEmployeeBySlipFileName(fileName, employees);
      if (match.status !== "ok") {
        const failure = describeSlipMatchFailure(fileName, match);
        failed.push({
          fileName,
          error: failure.error,
          detail: failure.detail,
          code: match.status === "ambiguous" ? "MATCH_AMBIGUOUS" : "MATCH_NONE",
        });
        continue;
      }

      const { employee, method } = match;
      const trimmedRecord = employee.recordCardNumber;
      const objectKey = `slips/${trimmedRecord}/${keySegment}.pdf`;

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        await uploadToR2(objectKey, buffer, "application/pdf");
        const { replacedExisting } = await upsertSalarySlipRecord({
          recordCardNumber: trimmedRecord,
          employeeId: employee.id,
          periodLabel: trimmedPeriod,
          objectKey,
          fileName,
        });
        ok.push({
          fileName,
          recordCardNumber: trimmedRecord,
          employeeName: employee.name,
          objectKey,
          replacedExisting,
          matchMethod: method,
        });
      } catch (err) {
        failed.push({
          fileName,
          error:
            err instanceof Error
              ? err.message
              : "Upload or save failed for this file",
          detail: replacedExistingHint(err),
          code: "UPLOAD_FAILED",
        });
      }
    }

    return NextResponse.json({
      success: true,
      periodLabel: trimmedPeriod,
      ok,
      failed,
      summary: {
        uploaded: ok.length,
        failed: failed.length,
        total: files.length,
      },
    });
  } catch (error) {
    console.error("POST /api/salary-slips/upload-batch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Batch upload failed unexpectedly",
        detail:
          error instanceof Error
            ? error.stack?.split("\n")[0]
            : "Check server logs for more information.",
        code: "BATCH_UNEXPECTED",
      },
      { status: 500 },
    );
  }
}

function replacedExistingHint(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  if (err.message.includes("R2")) {
    return "Cloudflare R2 rejected the upload. Check R2 credentials and bucket permissions.";
  }
  if (err.message.toLowerCase().includes("firestore")) {
    return "Firestore could not save the salary slip record.";
  }
  return undefined;
}
