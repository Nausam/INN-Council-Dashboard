import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { getAttendanceSyncDashboardStatus } = await import(
    "../lib/attendance-sync/status"
  );
  const { BOOTSTRAP_SYNC_BY_NAME } = await import(
    "../lib/attendance-sync/employee-sync"
  );
  const { getZkConfig } = await import("../lib/zk/config");
  const { getEtimeConfig } = await import("../lib/etime/config");
  const { isEtimeEnabled } = await import("../lib/attendance-sync/runtime");

  const status = await getAttendanceSyncDashboardStatus();
  const zk = getZkConfig();
  const etime = getEtimeConfig();

  console.log(JSON.stringify(
    {
      punchSources: {
        zkteco: {
          enabled: zk.enabled,
          device: zk.enabled ? `${zk.ip}:${zk.port}` : null,
          timezone: zk.timezone,
          connected: Boolean(status.zk.status?.lastHeartbeatAt),
          running: status.zk.status?.running ?? false,
          lastHeartbeat: status.zk.status?.lastHeartbeatAt ?? null,
          lastError: status.zk.status?.lastError ?? null,
          deviceSerial: status.zk.status?.deviceSerial ?? null,
          lastLogCount: status.zk.status?.lastLogCount ?? null,
        },
        etime: {
          enabled: isEtimeEnabled(),
          configured: etime.enabled && etime.errors.length === 0,
          baseUrl: etime.enabled ? etime.baseUrl : null,
          lastHeartbeat: status.etime.status?.lastHeartbeatAt ?? null,
          lastSuccessfulDate: status.etime.status?.lastSuccessfulDate ?? null,
          lastError: status.etime.status?.lastError ?? null,
        },
      },
      worker: {
        leaseOwner: status.lease?.ownerId ?? null,
        leaseExpires: status.lease?.expiresAt ?? null,
      },
      mappedEmployees: Object.entries(BOOTSTRAP_SYNC_BY_NAME).map(([name, cfg]) => ({
        name,
        zktecoUserId: cfg.zkteco?.userId ?? null,
        etimeCode: cfg.etime?.employeeCode ?? null,
        etimeEnabled: cfg.etime?.enabled ?? false,
      })),
      stats: {
        eligibleToday: status.mapping.eligibleToday,
        unmatchedPunches: status.unmatchedPunches,
        autoWrite: status.autoWrite,
      },
    },
    null,
    2,
  ));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
