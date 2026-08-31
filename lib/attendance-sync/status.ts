import { FieldValue } from "firebase-admin/firestore";

import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchAllEmployees } from "@/lib/firebase/hr";
import {
  buildSourceEmployeeMaps,
  BOOTSTRAP_SYNC_BY_NAME,
} from "@/lib/attendance-sync/employee-sync";
import { getEtimeStatus } from "@/lib/attendance-sync/import-etime";
import { countUnmatchedPunches } from "@/lib/attendance-sync/punch-store";
import { getWorkerLease } from "@/lib/attendance-sync/lease";
import {
  isAttendanceSyncAutoWriteEnabled,
  isAttendanceSyncPreviewMode,
  isEtimeEnabled,
} from "@/lib/attendance-sync/runtime";
import { todayMaldivesIso } from "@/lib/attendance-sync/time";
import { publicEtimeConfig } from "@/lib/etime/config";
import { getZkDashboardStatus } from "@/lib/zk/sync-service";
import { publicZkConfig } from "@/lib/zk/config";

const SHEETS_STATUS_ID = "attendance-sync-sheets";
const RECONCILE_STATUS_ID = "attendance-sync-reconcile";

export type IntegrationSliceStatus = {
  lastHeartbeatAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  lastDate?: string | null;
  previewMode?: boolean;
  autoWrite?: boolean;
};

export async function updateSheetsStatus(
  patch: IntegrationSliceStatus,
): Promise<void> {
  await getFirestoreDb()
    .collection(COLLECTIONS.integrationStatus)
    .doc(SHEETS_STATUS_ID)
    .set(
      {
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function updateReconcileStatus(
  patch: IntegrationSliceStatus,
): Promise<void> {
  await getFirestoreDb()
    .collection(COLLECTIONS.integrationStatus)
    .doc(RECONCILE_STATUS_ID)
    .set(
      {
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function getAttendanceSyncDashboardStatus() {
  const today = todayMaldivesIso();
  const employees = await fetchAllEmployees();
  const maps = buildSourceEmployeeMaps(employees, today);
  const [zk, etimeStatus, lease, unmatched, sheetsSnap, reconcileSnap] =
    await Promise.all([
      getZkDashboardStatus(),
      getEtimeStatus(),
      getWorkerLease(),
      countUnmatchedPunches(200),
      getFirestoreDb()
        .collection(COLLECTIONS.integrationStatus)
        .doc(SHEETS_STATUS_ID)
        .get(),
      getFirestoreDb()
        .collection(COLLECTIONS.integrationStatus)
        .doc(RECONCILE_STATUS_ID)
        .get(),
    ]);

  const bootstrapConfigured = employees.filter(
    (employee) => BOOTSTRAP_SYNC_BY_NAME[employee.name?.trim() ?? ""],
  ).length;

  return {
    previewMode: isAttendanceSyncPreviewMode(),
    autoWrite: isAttendanceSyncAutoWriteEnabled(),
    zk: {
      ...zk,
      config: publicZkConfig(),
    },
    etime: {
      config: publicEtimeConfig(),
      enabled: isEtimeEnabled(),
      status: etimeStatus,
    },
    sheets: sheetsSnap.exists ? sheetsSnap.data() : null,
    reconcile: reconcileSnap.exists ? reconcileSnap.data() : null,
    lease,
    unmatchedPunches: unmatched,
    mapping: {
      eligibleToday: maps.byEmployeeId.size,
      duplicateZkIds: maps.duplicateZkIds,
      duplicateEtimeCodes: maps.duplicateEtimeCodes,
      bootstrapConfigured,
    },
  };
}

export async function runAttendanceSyncJob(request: {
  from: string;
  to: string;
  sources: Array<"zkteco" | "etime">;
  mode: "preview" | "apply";
  ensureSheets?: boolean;
  reconcile?: boolean;
}) {
  const { enumerateIsoDates } = await import("@/lib/attendance-sync/time");
  const { ensureMosqueAttendanceSheets } = await import(
    "@/lib/attendance-sync/ensure-sheets"
  );
  const { reconcileMosqueAttendanceDate } = await import(
    "@/lib/attendance-sync/reconcile"
  );
  const { importZktecoFromDeviceRange } = await import(
    "@/lib/attendance-sync/import-zkteco"
  );
  const { importEtimePunches } = await import("@/lib/attendance-sync/import-etime");

  const preview = request.mode === "preview";
  const dates = enumerateIsoDates(request.from, request.to);
  const imports: Record<string, unknown> = {};
  const ensureResults = [];
  const reconcileResults = [];

  if (request.sources.includes("zkteco")) {
    imports.zkteco = await importZktecoFromDeviceRange(request.from, request.to);
  }

  if (request.sources.includes("etime")) {
    imports.etime = await importEtimePunches({
      from: request.from,
      to: request.to,
      reconcile: false,
    });
  }

  if (request.ensureSheets !== false) {
    for (const date of dates) {
      ensureResults.push(await ensureMosqueAttendanceSheets(date, { preview }));
    }
  }

  if (request.reconcile !== false) {
    for (const date of dates) {
      reconcileResults.push(
        await reconcileMosqueAttendanceDate(date, undefined, { preview }),
      );
    }
  }

  return {
    preview,
    imports,
    ensure: ensureResults,
    reconcile: reconcileResults,
  };
}
