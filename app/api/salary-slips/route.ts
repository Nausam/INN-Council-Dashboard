import {
  createSalarySlipRecord,
  fetchEmployeeByRecordCardNumber,
  listSalarySlipsByRecordCard,
} from "@/lib/appwrite/appwrite";
import {
  getPresignedDownloadUrl,
  getPresignedViewUrl,
  isR2Configured,
} from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const recordCard = request.nextUrl.searchParams.get("recordCard");
  const trimmed = typeof recordCard === "string" ? recordCard.trim() : "";

  if (!trimmed) {
    return NextResponse.json(
      { error: "Record card number is required" },
      { status: 400 }
    );
  }

  try {
    const employee = await fetchEmployeeByRecordCardNumber(trimmed);
    if (!employee) {
      return NextResponse.json(
        { error: "No employee found for this record card number" },
        { status: 404 }
      );
    }

    const slips = await listSalarySlipsByRecordCard(trimmed);
    const hasR2 = isR2Configured();

    const slipsWithUrls = await Promise.all(
      slips.map(async (slip) => {
        let viewUrl: string | null = null;
        let downloadUrl: string | null = null;
        if (hasR2) {
          try {
            viewUrl = await getPresignedViewUrl(slip.objectKey);
            const filename =
              slip.fileName ?? `${slip.periodLabel.replace(/\s+/g, "-")}.pdf`;
            downloadUrl = await getPresignedDownloadUrl(
              slip.objectKey,
              filename
            );
          } catch (e) {
            console.error("R2 presign error for", slip.objectKey, e);
          }
        }
        return {
          periodLabel: slip.periodLabel,
          fileName: slip.fileName ?? undefined,
          viewUrl,
          downloadUrl,
        };
      })
    );

    return NextResponse.json({
      employee: {
        name: employee.name,
        recordCardNumber:
          (employee as { recordCardNumber?: string }).recordCardNumber ?? trimmed,
      },
      slips: slipsWithUrls,
    });
  } catch (error) {
    console.error("GET /api/salary-slips error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load salary slips",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      recordCardNumber,
      periodLabel,
      objectKey,
      fileName,
      employeeId,
    } = body as {
      recordCardNumber?: string;
      periodLabel?: string;
      objectKey?: string;
      fileName?: string;
      employeeId?: string;
    };

    const trimmedRecord = typeof recordCardNumber === "string" ? recordCardNumber.trim() : "";
    if (!trimmedRecord || typeof periodLabel !== "string" || !periodLabel.trim()) {
      return NextResponse.json(
        { error: "recordCardNumber and periodLabel are required" },
        { status: 400 }
      );
    }
    if (typeof objectKey !== "string" || !objectKey.trim()) {
      return NextResponse.json(
        { error: "objectKey is required" },
        { status: 400 }
      );
    }

    const doc = await createSalarySlipRecord({
      recordCardNumber: trimmedRecord,
      employeeId: typeof employeeId === "string" ? employeeId : undefined,
      periodLabel: periodLabel.trim(),
      objectKey: objectKey.trim(),
      fileName: typeof fileName === "string" ? fileName : undefined,
    });

    return NextResponse.json({ id: doc.$id, ...doc });
  } catch (error) {
    console.error("POST /api/salary-slips error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create salary slip record",
      },
      { status: 500 }
    );
  }
}
