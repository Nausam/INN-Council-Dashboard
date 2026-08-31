import { getRequiredZkConfig, getZkConfig, publicZkConfig } from "@/lib/zk/config";
import { withZkClient, ZkDeviceClient } from "@/lib/zk/client";
import { importZktecoPunches } from "@/lib/attendance-sync/import-zkteco";
import {
  getLatestPunch,
  getZkStatus,
  listRecentPunches,
  loadEmployeePunchMap,
  updateZkStatus,
} from "@/lib/zk/punch-repository";
import type { ZkAttendanceRecord, ZkInfo } from "node-zklib";

export type ZkSyncResult = {
  scanned: number;
  valid: number;
  written: number;
  skipped: number;
  unmatched: number;
  from?: string;
  to?: string;
};

export type ZkConnectionTestResult = {
  ok: boolean;
  info: ZkInfo;
  serial: string | null;
  logCount: number | null;
  logCapacity: number | null;
  userCount: number;
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function assertSyncDateRange(from?: string, to?: string): void {
  if (from && !isIsoDate(from)) throw new Error("Invalid from date.");
  if (to && !isIsoDate(to)) throw new Error("Invalid to date.");
  if (from && to && from > to) throw new Error("From date must be before to date.");
}

export async function getZkDashboardStatus() {
  const config = getZkConfig();
  const [status, latestPunch, recentPunches, employees] = await Promise.all([
    getZkStatus(),
    getLatestPunch(),
    listRecentPunches(10),
    loadEmployeePunchMap(),
  ]);

  const enrichPunch = <T extends { deviceUserId?: string; empId?: string; empName?: string | null }>(
    punch: T | null,
  ) => {
    if (!punch) return null;
    const deviceUserId = String(punch.deviceUserId ?? punch.empId ?? "").trim();
    const employee = deviceUserId ? employees.get(deviceUserId) : null;
    return {
      ...punch,
      matchedEmployeeName: employee?.name ?? null,
      displayEmployeeName: punch.empName || employee?.name || null,
    };
  };

  return {
    config: publicZkConfig(config),
    status,
    latestPunch: enrichPunch(latestPunch),
    recentPunches: recentPunches.map(enrichPunch),
  };
}

export async function testZkConnection(): Promise<ZkConnectionTestResult> {
  const config = getRequiredZkConfig();

  return withZkClient(config, async (client) => {
    const [info, users] = await Promise.all([client.getInfo(), client.getUsers()]);
    const serial = typeof info.serialnumber === "string" ? info.serialnumber : null;
    const logCount =
      typeof info.logCounts === "number" && Number.isFinite(info.logCounts)
        ? info.logCounts
        : null;
    const logCapacity =
      typeof info.logCapacity === "number" && Number.isFinite(info.logCapacity)
        ? info.logCapacity
        : null;

    await updateZkStatus({
      enabled: true,
      running: false,
      deviceIp: config.ip,
      devicePort: config.port,
      deviceSerial: serial,
      lastLogCount: logCount,
      lastHeartbeatAt: new Date().toISOString(),
      lastError: null,
    });

    return {
      ok: true,
      info,
      serial,
      logCount,
      logCapacity,
      userCount: users.length,
    };
  });
}

export async function writeZkAttendanceRecords(
  records: ZkAttendanceRecord[],
  options: {
    deviceSerial?: string | null;
    from?: string;
    to?: string;
  } = {},
): Promise<ZkSyncResult> {
  const config = getRequiredZkConfig();
  assertSyncDateRange(options.from, options.to);

  const result = await importZktecoPunches({
    records,
    deviceSerial: options.deviceSerial,
    from: options.from,
    to: options.to,
    timezone: config.timezone,
  });

  return {
    scanned: result.scanned,
    valid: result.valid,
    written: result.written,
    skipped: result.skipped,
    unmatched: result.unmatched,
    from: result.from,
    to: result.to,
  };
}

export async function syncZkDateRange(from: string, to = from): Promise<ZkSyncResult> {
  const config = getRequiredZkConfig();
  assertSyncDateRange(from, to);
  await updateZkStatus({
    enabled: true,
    running: false,
    deviceIp: config.ip,
    devicePort: config.port,
    lastSyncStartedAt: new Date().toISOString(),
    lastError: null,
  });

  try {
    const result = await withZkClient(config, async (client) => {
      const info = await client.getInfo();
      const records = await client.getAttendances();
      return writeZkAttendanceRecords(records, {
        deviceSerial:
          typeof info.serialnumber === "string" ? info.serialnumber : "unknown",
        from,
        to,
      });
    });

    await updateZkStatus({
      lastSyncCompletedAt: new Date().toISOString(),
      lastError: null,
    });
    return result;
  } catch (error) {
    await updateZkStatus({
      lastError: error instanceof Error ? error.message : String(error),
      lastSyncCompletedAt: new Date().toISOString(),
    });
    throw error;
  }
}

export async function syncLatestZkRecords(
  client: ZkDeviceClient,
  delta: number,
): Promise<ZkSyncResult> {
  const info = await client.getInfo();
  const records = await client.getRecentAttendances(Math.max(delta + 25, 50));
  return writeZkAttendanceRecords(records, {
    deviceSerial: typeof info.serialnumber === "string" ? info.serialnumber : "unknown",
  });
}
