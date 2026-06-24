import { NextResponse } from "next/server";

import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { testZkConnection } from "@/lib/zk/sync-service";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json(await testZkConnection());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection test failed" },
      { status: adminErrorStatus(error) },
    );
  }
}
