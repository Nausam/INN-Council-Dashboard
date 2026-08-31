import { NextRequest, NextResponse } from "next/server";

import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { runAttendanceSyncJob } from "@/lib/attendance-sync/status";
import { ETIME_MAX_DAYS } from "@/lib/attendance-sync/types";
import { addDaysIso, assertIsoDate, todayMaldivesIso } from "@/lib/attendance-sync/time";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as {
      from?: unknown;
      to?: unknown;
      sources?: unknown;
      mode?: unknown;
      ensureSheets?: unknown;
      reconcile?: unknown;
    };

    const from =
      typeof body.from === "string" && body.from.trim()
        ? body.from.trim()
        : todayMaldivesIso();
    const to =
      typeof body.to === "string" && body.to.trim() ? body.to.trim() : from;
    const mode = body.mode === "apply" ? "apply" : "preview";
    const sourcesRaw = Array.isArray(body.sources) ? body.sources : ["zkteco"];
    const sources = sourcesRaw.filter(
      (value): value is "zkteco" | "etime" =>
        value === "zkteco" || value === "etime",
    );

    assertIsoDate(from);
    assertIsoDate(to);
    if (from > to) {
      return NextResponse.json({ error: "From date must be before to date." }, { status: 400 });
    }

    const oldestAllowed = addDaysIso(todayMaldivesIso(), -ETIME_MAX_DAYS);
    if (from < oldestAllowed) {
      return NextResponse.json(
        { error: `Date range exceeds ${ETIME_MAX_DAYS}-day eTime window.` },
        { status: 400 },
      );
    }

    if (sources.length === 0) {
      return NextResponse.json({ error: "Select at least one source." }, { status: 400 });
    }

    const result = await runAttendanceSyncJob({
      from,
      to,
      sources,
      mode,
      ensureSheets: body.ensureSheets !== false,
      reconcile: body.reconcile !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Run failed" },
      { status: adminErrorStatus(error) },
    );
  }
}
