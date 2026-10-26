import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Write the ZK heartbeat at least this often while nothing changes. */
const ZK_HEARTBEAT_MS = 2 * 60_000;
/** Polls only reconcile changed days, so today is repaired this often anyway. */
const TODAY_REPAIR_MS = 60 * 60_000;
/** ...and the two days before today this often. */
const RECENT_REPAIR_MS = 6 * 60 * 60_000;
/** Records re-read past the last imported device count, in case the saved count lags. */
const ZK_CATCHUP_MARGIN = 50;
/**
 * Exit if the worker stops making progress this long, so the scheduled task
 * restarts it. A Firestore call that never settles after a network drop
 * otherwise leaves the process alive but idle (Oct 22 2026: stuck 3 days).
 */
const STALL_LIMIT_MS = 15 * 60_000;
/** Startup recovery can backfill weeks of sheets in one call. */
const STARTUP_STALL_LIMIT_MS = 60 * 60_000;

async function main() {
  const { getRequiredZkConfig } = await import("../lib/zk/config");
  const { ZkDeviceClient } = await import("../lib/zk/client");
  const { importLatestZktecoRecords } = await import(
    "../lib/attendance-sync/import-zkteco"
  );
  const { getEtimeStatus, importEtimePunches } = await import("../lib/attendance-sync/import-etime");
  const { ensureMosqueAttendanceSheets, ensureMissingDates } = await import(
    "../lib/attendance-sync/ensure-sheets"
  );
  const { reconcileMosqueAttendanceDate } = await import(
    "../lib/attendance-sync/reconcile"
  );
  const { ensureCouncilAttendanceSheets, reconcileCouncilAttendanceDate } =
    await import("../lib/attendance-sync/council");
  const {
    tryAcquireWorkerLease,
    renewWorkerLease,
    releaseWorkerLease,
    WORKER_LEASE_RENEW_MS,
  } = await import("../lib/attendance-sync/lease");
  const { getCouncilSheetsLastDate, getSheetsLastDate, updateCouncilSheetsStatus,
    updateReconcileStatus, updateSheetsStatus } = await import(
    "../lib/attendance-sync/status"
  );
  const { getZkStatus, updateZkStatus } = await import("../lib/zk/punch-repository");
  const { enableProcessReadCache } = await import("../lib/firebase/hr");
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
  // Every poll needs the employee list and holidays; edits reach the worker within 5 minutes.
  enableProcessReadCache(5 * 60_000);

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });

  let stallDeadline = Date.now() + STALL_LIMIT_MS;
  const markProgress = (limitMs = STALL_LIMIT_MS) => {
    stallDeadline = Date.now() + limitMs;
  };
  const watchdog = setInterval(() => {
    if (Date.now() <= stallDeadline) return;
    console.error(
      "Attendance sync worker made no progress before its stall deadline; exiting so the scheduled task restarts it.",
    );
    process.exit(1);
  }, 60_000);

  let hasLease = false;
  while (!stopping && !hasLease) {
    try {
      hasLease = await tryAcquireWorkerLease({ sameHostTakeover: true });
      if (!hasLease) console.warn("Waiting for the attendance-sync worker lease");
    } catch (error) {
      console.error("Could not acquire worker lease; retrying:", error);
    }
    markProgress();
    if (!hasLease && !stopping) await sleep(15_000);
  }
  if (stopping) {
    clearInterval(watchdog);
    return;
  }

  console.log("Attendance sync worker starting");
  let lastSheetDate = todayMaldivesIso();
  let lastReconcileDate = "";
  let lastEtimeTodayPoll = 0;
  let lastEtimeHistoryPoll = 0;
  let recoveredEtimeHistory = false;
  let nextEtimeHistoryDate = "";
  let etimeRetryMs = 60_000;
  let lastTodayRepair = Date.now();
  let lastRecentRepair = Date.now();
  // Device punches this process has already stored (see importLatestZktecoRecords).
  const knownPunchKeys = new Set<string>();
  // Device log count already imported; kept across ZK reconnects.
  let importedLogCount: number | null = null;
  let lastZkStatusWrite = 0;
  let lastZkStatusKey = "";

  const catchUpSheets = async () => {
    const today = todayMaldivesIso();
    const lastMosqueDate = await getSheetsLastDate();
    const from = lastMosqueDate && lastMosqueDate <= today
      ? lastMosqueDate < today ? addDaysIso(lastMosqueDate, 1) : today
      : mosqueRecoveryStartDate(today);
    console.log(`Recovering mosque sheets and stored punches: ${from} through ${today}`);
    await ensureMissingDates(from, today, { preview: false });
    const lastCouncilDate = await getCouncilSheetsLastDate();
    const councilFrom = lastCouncilDate && lastCouncilDate < today
      ? addDaysIso(lastCouncilDate, 1)
      : today;
    for (const date of enumerateIsoDates(councilFrom, today)) {
      await ensureCouncilAttendanceSheets(date, { preview: false });
    }
    await updateCouncilSheetsStatus({
      lastSuccessAt: new Date().toISOString(),
      lastDate: today,
      lastHeartbeatAt: new Date().toISOString(),
    });
    // Sheets may have been created after their punches were already imported.
    for (const date of enumerateIsoDates(councilFrom < from ? councilFrom : from, today)) {
      if (date >= from) await reconcileMosqueAttendanceDate(date, undefined, { preview: false });
      await reconcileCouncilAttendanceDate(date, { preview: false });
    }
    await updateSheetsStatus({
      lastSuccessAt: new Date().toISOString(),
      lastDate: today,
      lastHeartbeatAt: new Date().toISOString(),
    });
    lastSheetDate = today;
    console.log("Attendance sheet recovery complete");
  };

  let renewingLease = false;
  const renewLoop = setInterval(() => {
    if (renewingLease) return;
    renewingLease = true;
    void (async () => {
      try {
        const renewed = await renewWorkerLease();
        if (!renewed && !(await tryAcquireWorkerLease())) {
          console.error("Attendance sync worker lease belongs to another process. Exiting.");
          process.exit(1);
        }
      } catch (error) {
        console.error("Worker lease renewal failed:", error);
      } finally {
        renewingLease = false;
      }
    })();
  }, WORKER_LEASE_RENEW_MS);

  // Recovery can take longer than the lease TTL; renew throughout startup.
  markProgress(STARTUP_STALL_LIMIT_MS);
  try {
    await catchUpSheets();
  } catch (error) {
    clearInterval(renewLoop);
    clearInterval(watchdog);
    await releaseWorkerLease().catch(() => undefined);
    throw error;
  }
  markProgress();

  // After a restart, re-read eTime from shortly before the last successful poll
  // (at most back to the start of last month) rather than all of last month.
  const lastEtimeDate = isEtimeEnabled()
    ? (await getEtimeStatus().catch(() => null))?.lastSuccessfulDate ?? null
    : null;
  const etimeRecoveryStart = (today: string) => {
    const earliest = mosqueRecoveryStartDate(today);
    if (!lastEtimeDate || !/^\d{4}-\d{2}-\d{2}$/.test(lastEtimeDate)) return earliest;
    const fromLast = addDaysIso(lastEtimeDate, -2);
    return fromLast > earliest ? fromLast : earliest;
  };

  // The ZK status doc is the admin panel's heartbeat: write it when something
  // changes, otherwise every ZK_HEARTBEAT_MS.
  const writeZkHeartbeat = async (patch: { lastLogCount: number; lastError: string | null }) => {
    const key = `${patch.lastLogCount}|${patch.lastError ?? ""}`;
    if (key === lastZkStatusKey && Date.now() - lastZkStatusWrite < ZK_HEARTBEAT_MS) return;
    await updateZkStatus({ running: true, ...patch, lastHeartbeatAt: new Date().toISOString() });
    lastZkStatusKey = key;
    lastZkStatusWrite = Date.now();
  };

  const runEtimePoll = async (from: string, to: string) => {
    if (!isEtimeEnabled()) return false;
    const config = getEtimeConfig();
    if (config.errors.length > 0) {
      console.warn("eTime config errors:", config.errors.join("; "));
      return false;
    }

    try {
      const result = await importEtimePunches({ from, to, reconcile: true, incremental: true });
      // Quiet polls (nothing new on the eTime page) aren't logged.
      if (result.written > 0 || (result.voided ?? 0) > 0 || result.affectedDates.length > 0) {
        console.log(
          `eTime poll ${from} through ${to}: written=${result.written}, voided=${result.voided ?? 0}, reconciled=${result.affectedDates.join(",") || "none"}`,
        );
      }
      etimeRetryMs = 60_000;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("eTime poll failed:", message);
      etimeRetryMs = Math.min(etimeRetryMs * 2, config.maxRetryMs);
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

      // Read before this connect overwrites it with the current device count.
      if (importedLogCount === null) {
        const saved = (await getZkStatus().catch(() => null))?.lastLogCount;
        importedLogCount = typeof saved === "number" && Number.isFinite(saved) ? saved : null;
      }

      // lastLogCount is saved by the heartbeat once the catch-up below has
      // imported those records, so a crash mid-import re-imports them next start.
      await updateZkStatus({
        enabled: true,
        running: true,
        deviceIp: zkConfig.ip,
        devicePort: zkConfig.port,
        deviceSerial: serial,
        lastHeartbeatAt: new Date().toISOString(),
        lastError: null,
      });
      lastZkStatusKey = "";

      // Import only records added since the last import (this run, or the count
      // saved before a restart), plus a margin. Without a usable count, e.g.
      // after the device log was cleared, fall back to the full catch-up.
      const sinceImported = importedLogCount !== null && lastLogCount >= importedLogCount
        ? lastLogCount - importedLogCount + ZK_CATCHUP_MARGIN
        : lastLogCount;
      const catchupCount = Math.min(lastLogCount, sinceImported, zkConfig.startupCatchupRecords);
      if (catchupCount > 0) {
        const recentCount = Math.min(catchupCount, 75);
        console.log(`Importing ${recentCount} newest device records first`);
        const recentRecords = await client.getRecentAttendances(recentCount);
        const recent = await importLatestZktecoRecords(
          recentRecords,
          serial,
          zkConfig.timezone,
          { incremental: true, knownPunchKeys },
        );
        console.log(
          `ZK recent: written=${recent.written}, skipped=${recent.skipped}, unmatched=${recent.unmatched}`,
        );
        markProgress();
      }
      if (catchupCount > 75) {
        console.log(`Reading and importing ${catchupCount} recent device records; startup may take several minutes`);
        const records = await client.getRecentAttendances(Math.max(catchupCount + 25, 50));
        const catchup = await importLatestZktecoRecords(
          records,
          serial,
          zkConfig.timezone,
          { incremental: true, knownPunchKeys },
        );
        console.log(
          `ZK catch-up: written=${catchup.written}, skipped=${catchup.skipped}, unmatched=${catchup.unmatched}`,
        );
        markProgress();
      }
      importedLogCount = lastLogCount;

      while (!stopping) {
        const now = Date.now();
        const today = todayMaldivesIso();

        if (isPastDailyCreationTime() && lastSheetDate !== today) {
          for (const date of enumerateIsoDates(addDaysIso(lastSheetDate, 1), today)) {
            await ensureMosqueAttendanceSheets(date, { preview: false });
            await ensureCouncilAttendanceSheets(date, { preview: false });
            await reconcileCouncilAttendanceDate(date, { preview: false });
          }
          await updateCouncilSheetsStatus({
            lastSuccessAt: new Date().toISOString(),
            lastDate: today,
            lastHeartbeatAt: new Date().toISOString(),
          });
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
          await reconcileCouncilAttendanceDate(yesterday, { preview: false });
          await updateReconcileStatus({
            lastSuccessAt: new Date().toISOString(),
            lastDate: yesterday,
            lastHeartbeatAt: new Date().toISOString(),
          });
          lastReconcileDate = today;
        }

        // Imports only reconcile days whose punches changed. Repair recent days
        // on a timer too, in case a sheet changed some other way (a new
        // employee, a cleared row, a leave edit).
        if (now - lastTodayRepair >= TODAY_REPAIR_MS) {
          await reconcileMosqueAttendanceDate(today, undefined, { preview: false });
          await reconcileCouncilAttendanceDate(today, { preview: false, ensureToday: true });
          lastTodayRepair = now;
        }
        if (now - lastRecentRepair >= RECENT_REPAIR_MS) {
          for (const date of [addDaysIso(today, -2), yesterday]) {
            await reconcileMosqueAttendanceDate(date, undefined, { preview: false });
            await reconcileCouncilAttendanceDate(date, { preview: false });
          }
          lastRecentRepair = now;
        }

        if (isEtimeEnabled()) {
          const etimeConfig = getEtimeConfig();
          if (now - lastEtimeTodayPoll >= etimeConfig.pollTodayMs) {
            await runEtimePoll(today, today);
            lastEtimeTodayPoll = now;
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
            { incremental: true, knownPunchKeys },
          );
          importedLogCount = count;
          console.log(
            `ZK delta +${delta}: written=${result.written}, skipped=${result.skipped}`,
          );
        } else if (count < lastLogCount) {
          logCountReset = true;
          lastLogCount = count;
          importedLogCount = count;
        }

        await writeZkHeartbeat({
          lastLogCount,
          lastError: logCountReset ? "Device log count reset detected" : null,
        });

        // Recover eTime history one day at a time so ZK device polling keeps running.
        if (isEtimeEnabled()) {
          const etimeConfig = getEtimeConfig();
          if (!recoveredEtimeHistory) {
            if (!nextEtimeHistoryDate) nextEtimeHistoryDate = etimeRecoveryStart(today);
            if (nextEtimeHistoryDate > yesterday) {
              recoveredEtimeHistory = true;
              lastEtimeHistoryPoll = Date.now();
            } else if (Date.now() - lastEtimeHistoryPoll >= etimeRetryMs) {
              const historyDate = nextEtimeHistoryDate;
              const recovered = await runEtimePoll(historyDate, historyDate);
              nextEtimeHistoryDate = recovered
                ? addDaysIso(historyDate, 1)
                : historyDate;
              lastEtimeHistoryPoll = recovered ? 0 : Date.now();
            }
          } else if (now - lastEtimeHistoryPoll >= etimeConfig.pollHistoryMs) {
            await runEtimePoll(addDaysIso(today, -2), yesterday);
            lastEtimeHistoryPoll = Date.now();
          }
        }

        markProgress();
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
      lastZkStatusKey = "";
      // A failed attempt is still progress: the loop is alive and will reconnect.
      markProgress();
      if (!stopping) await sleep(zkConfig.reconnectMs);
    }
  }

  clearInterval(renewLoop);
  clearInterval(watchdog);
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
