import { NextResponse } from "next/server";

import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { getZkDashboardStatus } from "@/lib/zk/sync-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getZkDashboardStatus());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load status" },
      { status: adminErrorStatus(error) },
    );
  }
}
