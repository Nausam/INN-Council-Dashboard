/* eslint-disable @typescript-eslint/no-explicit-any */
import { appwriteService } from "@/appwriteService";
import { zkService } from "@/zktecoService";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret (security)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await zkService.connect();
    const records = await zkService.getAttendanceRecords();
    await zkService.disconnect();

    const results = await appwriteService.bulkSaveAttendance(records);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
