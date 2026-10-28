import { NextResponse } from "next/server";

import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { buildManualChit } from "@/lib/leave/manual-chit";

export const runtime = "nodejs";

/** Makes an annual leave chit by hand from the Admin page. Nothing is saved. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as Record<string, unknown>;
    const employeeId = String(body.employeeId ?? "").trim();
    const approverEmployeeId = String(body.approverEmployeeId ?? "").trim();
    if (!/^[\w-]{1,128}$/.test(employeeId) || !/^[\w-]{1,128}$/.test(approverEmployeeId)) {
      return NextResponse.json({ error: "Choose the employee and who signs" }, { status: 400 });
    }
    const reason = String(body.reason ?? "").trim();
    if (reason.length > 500) {
      return NextResponse.json({ error: "Keep the reason under 500 characters" }, { status: 400 });
    }
    const balanceAfter = typeof body.balanceAfter === "number" && Number.isFinite(body.balanceAfter) && body.balanceAfter >= 0
      ? Math.round(body.balanceAfter)
      : undefined;

    const { bytes, fileName } = await buildManualChit({
      employeeId,
      startDate: String(body.startDate ?? ""),
      endDate: String(body.endDate ?? ""),
      approverEmployeeId,
      reason,
      balanceAfter,
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const status = adminErrorStatus(error);
    return NextResponse.json(
      { error: status === 500 && error instanceof Error ? error.message : "Admin access required" },
      { status },
    );
  }
}
