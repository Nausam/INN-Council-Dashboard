import { NextRequest, NextResponse } from "next/server";

import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { syncZkDateRange } from "@/lib/zk/sync-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as {
      from?: unknown;
      to?: unknown;
    };
    const from =
      typeof body.from === "string" && body.from.trim() ? body.from.trim() : "";
    const to =
      typeof body.to === "string" && body.to.trim() ? body.to.trim() : from;

    if (!from) {
      return NextResponse.json({ error: "From date is required" }, { status: 400 });
    }

    return NextResponse.json(await syncZkDateRange(from, to));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: adminErrorStatus(error) },
    );
  }
}
