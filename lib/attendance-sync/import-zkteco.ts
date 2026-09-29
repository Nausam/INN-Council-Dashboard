import type { ZkAttendanceRecord } from "node-zklib";

import { fetchAllEmployees } from "@/lib/firebase/hr";
import {
  buildSourceEmployeeMaps,
  type SyncEligibleEmployee,
} from "@/lib/attendance-sync/employee-sync";
import { writeCanonicalPunchIfNew } from "@/lib/attendance-sync/punch-store";
import { reconcileMosqueAttendanceDate } from "@/lib/attendance-sync/reconcile";
import { reconcileCouncilAttendanceDate } from "@/lib/attendance-sync/council";
import {
  isAttendanceSyncAutoWriteEnabled,
} from "@/lib/attendance-sync/runtime";
import { utcToMaldivesParts } from "@/lib/attendance-sync/time";
import type { AttendancePunchDoc, ImportResult } from "@/lib/attendance-sync/types";
import { MALDIVES_TIMEZONE } from "@/lib/attendance-sync/types";
import { updateZkStatus } from "@/lib/zk/punch-repository";
import {
  makeDedupeKey,
  normalizeHumanName,
  normalizePunch,
  pickDeviceUserId,
  pickPunchTimestampIso,
} from "@/lib/zk/normalize";

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function inDateRange(localDate: string, from?: string, to?: string): boolean {
  if (from && localDate < from) return false;
  if (to && localDate > to) return false;
  return true;
}

export function assertImportDateRange(from?: string, to?: string): void {
  if (from && !isIsoDate(from)) throw new Error("Invalid from date.");
  if (to && !isIsoDate(to)) throw new Error("Invalid to date.");
  if (from && to && from > to) throw new Error("From date must be before to date.");
}

function matchEmployeeForZkUser(
  userId: string,
  maps: ReturnType<typeof buildSourceEmployeeMaps>,
  legacyMap: Map<string, SyncEligibleEmployee | undefined>,
): SyncEligibleEmployee | null {
  const fromConfig = maps.zkByUserId.get(userId);
  if (fromConfig) return fromConfig;
  return legacyMap.get(userId) ?? null;
}

export async function importZktecoPunches(options: {
  records: ZkAttendanceRecord[];
  deviceSerial?: string | null;
  from?: string;
  to?: string;
  timezone?: string;
  reconcile?: boolean;
}): Promise<ImportResult> {
  assertImportDateRange(options.from, options.to);
  const deviceSn = options.deviceSerial || "unknown";
  const timezone = options.timezone ?? "Indian/Maldives";
  const employees = await fetchAllEmployees();
  const mapsByDate = new Map<string, {
    maps: ReturnType<typeof buildSourceEmployeeMaps>;
    legacyMap: Map<string, SyncEligibleEmployee | undefined>;
  }>();
  const mappingForDate = (date: string) => {
    const cached = mapsByDate.get(date);
    if (cached) return cached;
    const maps = buildSourceEmployeeMaps(employees, date);
    const legacyMap = new Map<string, SyncEligibleEmployee | undefined>();
    for (const entry of maps.byEmployeeId.values()) {
      const legacyId = entry.employee.deviceUserId?.trim();
      if (!legacyId || entry.config.zkteco?.enabled === false ||
          maps.duplicateZkIds.includes(legacyId)) continue;
      if (legacyMap.has(legacyId)) legacyMap.set(legacyId, undefined);
      else legacyMap.set(legacyId, entry);
    }
    const mapping = { maps, legacyMap };
    mapsByDate.set(date, mapping);
    return mapping;
  };

  let valid = 0;
  let written = 0;
  let skipped = 0;
  let unmatched = 0;
  const affectedDates = new Set<string>();
  const preparedPunches: Array<{ punch: AttendancePunchDoc; matchedDate: string | null }> = [];

  for (const record of options.records) {
    const timestamp = pickPunchTimestampIso(record as Record<string, unknown>, timezone);
    if (!timestamp) continue;

    const { localDate, localTime } = utcToMaldivesParts(timestamp);
    if (!inDateRange(localDate, options.from, options.to)) continue;

    const deviceUserId = pickDeviceUserId(record as Record<string, unknown>);
    if (!deviceUserId) continue;

    const { maps, legacyMap } = mappingForDate(localDate);
    const matched = matchEmployeeForZkUser(deviceUserId, maps, legacyMap);
    const legacyEmployee = matched
      ? { name: matched.employee.name, norm: normalizeHumanName(matched.employee.name) }
      : null;

    const legacyNormalized = normalizePunch(record as Record<string, unknown>, {
      deviceSn,
      employee: legacyEmployee,
      timezone,
    });
    if (!legacyNormalized) continue;

    valid += 1;
    if (!matched) unmatched += 1;

    const dedupeKey = makeDedupeKey(deviceSn, deviceUserId, timestamp);
    const now = new Date().toISOString();
    const punch: AttendancePunchDoc = {
      source: "zkteco",
      sourceRecordId: dedupeKey,
      sourceDeviceId: deviceSn,
      sourceEmployeeId: deviceUserId,
      employeeId: matched?.employee.$id ?? null,
      timestampUtc: timestamp,
      localDate,
      localTime,
      timezone: MALDIVES_TIMEZONE,
      eligible: true,
      ignoredReason: null,
      lastSeenAt: now,
      voidedAt: null,
      importedAt: now,
      dedupeKey,
      empName: legacyNormalized.empName,
      empNameNorm: legacyNormalized.empNameNorm,
      state: legacyNormalized.state,
    };

    preparedPunches.push({ punch, matchedDate: matched ? localDate : null });
  }

  // Firestore reads and writes are independent per punch. A small pool keeps
  // startup catch-up from blocking today's reconciliation for many minutes.
  let nextPunch = 0;
  const writeNext = async () => {
    while (nextPunch < preparedPunches.length) {
      const { punch, matchedDate } = preparedPunches[nextPunch++]!;
      const result = await writeCanonicalPunchIfNew(punch);
      if (matchedDate) affectedDates.add(matchedDate);
      if (result.written) written += 1;
      else skipped += 1;
    }
  };
  const writes = await Promise.allSettled(
    Array.from({ length: Math.min(8, preparedPunches.length) }, writeNext),
  );
  const failedWrite = writes.find((write) => write.status === "rejected");
  if (failedWrite?.status === "rejected") throw failedWrite.reason;

  if (written > 0) {
    await updateZkStatus({ lastWriteAt: new Date().toISOString() });
  }

  if (options.reconcile !== false && isAttendanceSyncAutoWriteEnabled()) {
    for (const date of Array.from(affectedDates)) {
      await reconcileMosqueAttendanceDate(date, undefined, { preview: false });
      await reconcileCouncilAttendanceDate(date, { preview: false, ensureToday: true });
    }
  }

  return {
    scanned: options.records.length,
    valid,
    written,
    skipped,
    unmatched,
    affectedDates: Array.from(affectedDates).sort(),
    from: options.from,
    to: options.to,
  };
}

export async function importZktecoFromDeviceRange(
  from: string,
  to = from,
  reconcile = true,
): Promise<ImportResult> {
  const { getRequiredZkConfig } = await import("@/lib/zk/config");
  const { withZkClient } = await import("@/lib/zk/client");

  const config = getRequiredZkConfig();
  return withZkClient(config, async (client) => {
    const info = await client.getInfo();
    const records = await client.getAttendances();
    return importZktecoPunches({
      records,
      deviceSerial:
        typeof info.serialnumber === "string" ? info.serialnumber : "unknown",
      from,
      to,
      timezone: config.timezone,
      reconcile,
    });
  });
}

export async function importLatestZktecoRecords(
  records: ZkAttendanceRecord[],
  deviceSerial: string | null,
  timezone: string,
): Promise<ImportResult> {
  return importZktecoPunches({
    records,
    deviceSerial,
    timezone,
  });
}
