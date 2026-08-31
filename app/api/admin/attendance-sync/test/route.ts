import { NextRequest, NextResponse } from "next/server";

import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { testEtimeConnection } from "@/lib/attendance-sync/import-etime";
import { testZkConnection } from "@/lib/zk/sync-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as { source?: unknown };
    const source = typeof body.source === "string" ? body.source.trim() : "zkteco";

    switch (source) {
      case "zkteco":
        return NextResponse.json(await testZkConnection());
      case "etime":
        return NextResponse.json(await testEtimeConnection());
      default:
        return NextResponse.json({ error: "Unknown source" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: adminErrorStatus(error) },
    );
  }
}
