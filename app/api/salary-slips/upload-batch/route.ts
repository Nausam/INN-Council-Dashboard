import {
  createSalarySlipRecord,
  fetchAllEmployees,
  type EmployeeDoc,
} from "@/lib/appwrite/appwrite";
import {
  matchEmployeeBySlipFileName,
  type SlipMatchEmployee,
} from "@/lib/salary-slips/matchSlipFileName";
import { uploadToR2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

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
    .map((e) => {
      const id = e.$id;
      const rc = e.recordCardNumber;
      const str = typeof rc === "string" ? rc.trim() : "";
      if (!str || typeof id !== "string") return null;
      return {
        id,
        name: e.name ?? "Unknown",
        recordCardNumber: str,
      };
    })
    .filter((o): o is SlipMatchEmployee => o !== null);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const periodLabel = formData.get("periodLabel") as string | null;
    const trimmedPeriod =
      typeof periodLabel === "string" ? periodLabel.trim() : "";

    if (!trimmedPeriod) {
      return NextResponse.json(
        { error: "Period label is required (e.g. 2026-01)" },
        { status: 400 },
      );
    }

    const rawFiles = formData.getAll("files");
    const files = rawFiles.filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Add one or more PDF files" },
        { status: 400 },
      );
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `At most ${MAX_FILES} files per batch` },
        { status: 400 },
      );
    }

    const employees = toSlipEmployees(await fetchAllEmployees());
    const keySegment = sanitizePeriodForKey(trimmedPeriod);

    type OkRow = {
      fileName: string;
      recordCardNumber: string;
      employeeName: string;
      objectKey: string;
    };
    type ErrRow = {
      fileName: string;
      error: string;
      detail?: string;
    };

    const ok: OkRow[] = [];
    const failed: ErrRow[] = [];

    for (const file of files) {
      const fileName = file.name || "unknown.pdf";

      if (!isPdfFile(file)) {
        failed.push({
          fileName,
          error: "Not a PDF",
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        failed.push({
          fileName,
          error: "File exceeds 10MB",
        });
        continue;
      }

      const match = matchEmployeeBySlipFileName(fileName, employees);
      if (match.status === "none") {
        failed.push({
          fileName,
          error: "No matching employee",
          detail:
            "Rename the file to match the employee name in the system (e.g. Ahmed Azmeen.pdf).",
        });
        continue;
      }
      if (match.status === "ambiguous") {
        failed.push({
          fileName,
          error: "Multiple employees match this name",
          detail: match.names.join("; "),
        });
        continue;
      }

      const { employee } = match;
      const trimmedRecord = employee.recordCardNumber;
      const objectKey = `slips/${trimmedRecord}/${keySegment}.pdf`;

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        await uploadToR2(objectKey, buffer, "application/pdf");
        await createSalarySlipRecord({
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
        });
      } catch (err) {
        failed.push({
          fileName,
          error:
            err instanceof Error ? err.message : "Upload or save failed",
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
          error instanceof Error
            ? error.message
            : "Failed batch upload",
      },
      { status: 500 },
    );
  }
}
