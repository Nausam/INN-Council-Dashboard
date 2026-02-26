import { listRecordCardNumbersWithSlipForPeriod } from "@/lib/appwrite/appwrite";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period");
  const trimmed = typeof period === "string" ? period.trim() : "";
  if (!trimmed) {
    return NextResponse.json(
      { error: "period is required (e.g. 2026-02)" },
      { status: 400 }
    );
  }
  try {
    const recordCardNumbers = await listRecordCardNumbersWithSlipForPeriod(trimmed);
    return NextResponse.json({ recordCardNumbers });
  } catch (error) {
    console.error("GET /api/salary-slips/uploaded error:", error);
    return NextResponse.json(
      { error: "Failed to load uploaded slips" },
      { status: 500 }
    );
  }
}
