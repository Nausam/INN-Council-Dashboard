import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { getRequiredZkConfig } = await import("../lib/zk/config");
  const { ZkDeviceClient } = await import("../lib/zk/client");
  const { importLatestZktecoRecords } = await import(
    "../lib/attendance-sync/import-zkteco"
  );
  const { importEtimePunches } = await import("../lib/attendance-sync/import-etime");
  const { ensureMosqueAttendanceSheets, ensureMissingDates } = await import(
    "../lib/attendance-sync/ensure-sheets"
  );
  const { reconcileMosqueAttendanceDate } = await import(
    "../lib/attendance-sync/reconcile"
  );
  const {
    tryAcquireWorkerLease,
    renewWorkerLease,
    releaseWorkerLease,
    WORKER_LEASE_RENEW_MS,
  } = await import("../lib/attendance-sync/lease");
  const { updateReconcileStatus, updateSheetsStatus } = await import(
    "../lib/attendance-sync/status"
  );
  const { updateZkStatus } = await import("../lib/zk/punch-repository");
  const {
    addDaysIso,
    isPastDailyCreationTime,
    isPastDailyReconcileTime,
    todayMaldivesIso,
    mosqueRecoveryStartDate,
    enumerateIsoDates,
  } = await import("../lib/attendance-sync/time");
  const { isEtimeEnabled } = await import("../lib/attendance-sync/runtime");
  const { getEtimeConfig } = await import("../lib/etime/config");

  const zkConfig = getRequiredZkConfig();
  process.env.TZ = zkConfig.timezone;

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });

  const hasLease = await tryAcquireWorkerLease();
  if (!hasLease) {
    console.error("Another attendance-sync worker holds the lease. Exiting.");
    process.exit(1);
  }

  console.log("Attendance sync worker starting");
  let lastSheetDate = todayMaldivesIso();
  let lastReconcileDate = "";
  let lastEtimeTodayPoll = 0;
  let lastEtimeHistoryPoll = 0;
  let recoveredEtimeHistory = false;
  let etimeRetryMs = 60_000;

  const catchUpSheets = async () => {
    const today = todayMaldivesIso();
    const from = mosqueRecoveryStartDate(today);
    console.log(`Recovering mosque sheets and stored punches: ${from} through ${today}`);
    await ensureMissingDates(from, today, { preview: false });
    // Sheets may have been created after their punches were already imported.
    for (const date of enumerateIsoDates(from, today)) {
      await reconcileMosqueAttendanceDate(date, undefined, { preview: false });
    }
    await updateSheetsStatus({
      lastSuccessAt: new Date().toISOString(),
      lastDate: today,
      lastHeartbeatAt: new Date().toISOString(),
    });
    lastSheetDate = today;
    console.log("Mosque sheet recovery complete");
  };

  const renewLoop = setInterval(() => {
    void renewWorkerLease()
      .then((ok) => {
        if (!ok) console.warn("Failed to renew worker lease");
      })
      .catch((error) => console.error("Worker lease renewal failed:", error));
  }, WORKER_LEASE_RENEW_MS);

  // Recovery can take longer than the lease TTL; renew throughout startup.
  try {
    await catchUpSheets();
  } catch (error) {
    clearInterval(renewLoop);
    await releaseWorkerLease().catch(() => undefined);
    throw error;
  }

  const runEtimePoll = async (from: string, to: string) => {
    if (!isEtimeEnabled()) return false;
    const config = getEtimeConfig();
    if (config.errors.length > 0) {
      console.warn("eTime config errors:", config.errors.join("; "));
      return false;
    }

    try {
      console.log(`eTime poll: ${from} through ${to}`);
      await importEtimePunches({ from, to, reconcile: true });
      etimeRetryMs = 60_000;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("eTime poll failed:", message);
      etimeRetryMs = Math.min(etimeRetryMs * 2, config.maxRetryMs);
      await sleep(etimeRetryMs);
      return false;
    }
  };

  while (!stopping) {
    try {
      const client = new ZkDeviceClient(zkConfig);
      await client.connect();
      const info = await client.getInfo();
      const serial =
        typeof info.serialnumber === "string" ? info.serialnumber : "unknown";
      let lastLogCount =
        typeof info.logCounts === "number" && Number.isFinite(info.logCounts)
          ? info.logCounts
          : 0;
      let logCountReset = false;

      await updateZkStatus({
        enabled: true,
        running: true,
        deviceIp: zkConfig.ip,
        devicePort: zkConfig.port,
        deviceSerial: serial,
        lastLogCount,
        lastHeartbeatAt: new Date().toISOString(),
        lastError: logCountReset ? "Device log count reset detected" : null,
      });

      const catchupCount = Math.min(lastLogCount, zkConfig.startupCatchupRecords);
      if (catchupCount > 0) {
        console.log(`Reading and importing ${catchupCount} recent device records; startup may take several minutes`);
        const records = await client.getRecentAttendances(Math.max(catchupCount + 25, 50));
        const catchup = await importLatestZktecoRecords(
          records,
          serial,
          zkConfig.timezone,
        );
        console.log(
          `ZK catch-up: written=${catchup.written}, skipped=${catchup.skipped}, unmatched=${catchup.unmatched}`,
        );
      }

      while (!stopping) {
        const now = Date.now();
        const today = todayMaldivesIso();

        if (isPastDailyCreationTime() && lastSheetDate !== today) {
          await ensureMosqueAttendanceSheets(today, { preview: false });
          await updateSheetsStatus({
            lastSuccessAt: new Date().toISOString(),
            lastDate: today,
            lastHeartbeatAt: new Date().toISOString(),
          });
          lastSheetDate = today;
        }

        const yesterday = addDaysIso(today, -1);
        if (isPastDailyReconcileTime() && lastReconcileDate !== today) {
          await reconcileMosqueAttendanceDate(yesterday, undefined, {
            preview: false,
          });
          await updateReconcileStatus({
            lastSuccessAt: new Date().toISOString(),
            lastDate: yesterday,
            lastHeartbeatAt: new Date().toISOString(),
          });
          lastReconcileDate = today;
        }

        if (isEtimeEnabled()) {
          const etimeConfig = getEtimeConfig();
          if (now - lastEtimeTodayPoll >= etimeConfig.pollTodayMs) {
            await runEtimePoll(today, today);
            lastEtimeTodayPoll = now;
          }
          if (now - lastEtimeHistoryPoll >= etimeConfig.pollHistoryMs) {
            const recovered = await runEtimePoll(
              recoveredEtimeHistory ? addDaysIso(today, -2) : mosqueRecoveryStartDate(today),
              yesterday,
            );
            if (recovered) recoveredEtimeHistory = true;
            lastEtimeHistoryPoll = now;
          }
        }

        const latestInfo = await client.getInfo();
        const count =
          typeof latestInfo.logCounts === "number" &&
          Number.isFinite(latestInfo.logCounts)
            ? latestInfo.logCounts
            : lastLogCount;

        if (count > lastLogCount) {
          const delta = count - lastLogCount;
          lastLogCount = count;
          const records = await client.getRecentAttendances(Math.max(delta + 25, 50));
          const result = await importLatestZktecoRecords(
            records,
            serial,
            zkConfig.timezone,
          );
          console.log(
            `ZK delta +${delta}: written=${result.written}, skipped=${result.skipped}`,
          );
        } else if (count < lastLogCount) {
          logCountReset = true;
          lastLogCount = count;
          await updateZkStatus({
            lastLogCount,
            lastError: "Device log count reset detected",
            lastHeartbeatAt: new Date().toISOString(),
          });
        }

        await updateZkStatus({
          running: true,
          lastLogCount,
          lastHeartbeatAt: new Date().toISOString(),
          lastError: logCountReset ? "Device log count reset detected" : null,
        });

        await renewWorkerLease();
        await sleep(zkConfig.pollMs);
      }

      await client.disconnect().catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Attendance sync worker error:", message);
      await updateZkStatus({
        enabled: true,
        running: false,
        deviceIp: zkConfig.ip,
        devicePort: zkConfig.port,
        lastError: message,
        lastHeartbeatAt: new Date().toISOString(),
      }).catch(() => undefined);
      if (!stopping) await sleep(zkConfig.reconnectMs);
    }
  }

  clearInterval(renewLoop);
  await releaseWorkerLease().catch(() => undefined);
  await updateZkStatus({
    running: false,
    lastHeartbeatAt: new Date().toISOString(),
  }).catch(() => undefined);
  console.log("Attendance sync worker stopped");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
