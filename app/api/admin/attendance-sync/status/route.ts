import { NextResponse } from "next/server";

import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { getAttendanceSyncDashboardStatus } from "@/lib/attendance-sync/status";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getAttendanceSyncDashboardStatus());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status failed" },
      { status: adminErrorStatus(error) },
    );
  }
}
