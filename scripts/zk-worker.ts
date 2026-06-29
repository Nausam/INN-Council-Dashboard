import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { getRequiredZkConfig } = await import("../lib/zk/config");
  const { ZkDeviceClient } = await import("../lib/zk/client");
  const { syncLatestZkRecords } = await import("../lib/zk/sync-service");
  const { updateZkStatus } = await import("../lib/zk/punch-repository");

  const config = getRequiredZkConfig();
  process.env.TZ = config.timezone;

  let stopping = false;
  let client: InstanceType<typeof ZkDeviceClient> | null = null;
  let lastLogCount = 0;

  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });

  console.log("ZKTeco worker starting");
  console.log(`Device: ${config.ip}:${config.port}`);
  console.log(`Firestore collection: punch_logs`);

  while (!stopping) {
    try {
      client = new ZkDeviceClient(config);
      await client.connect();

      const info = await client.getInfo();
      const serial =
        typeof info.serialnumber === "string" ? info.serialnumber : "unknown";
      lastLogCount =
        typeof info.logCounts === "number" && Number.isFinite(info.logCounts)
          ? info.logCounts
          : 0;

      await updateZkStatus({
        enabled: true,
        running: true,
        deviceIp: config.ip,
        devicePort: config.port,
        deviceSerial: serial,
        lastLogCount,
        lastHeartbeatAt: new Date().toISOString(),
        lastError: null,
      });

      console.log(`Connected. Serial=${serial}, baseline logs=${lastLogCount}`);

      const catchupCount = Math.min(lastLogCount, config.startupCatchupRecords);
      if (catchupCount > 0) {
        const catchup = await syncLatestZkRecords(client, catchupCount);
        console.log(
          `Startup catch-up: scanned=${catchup.scanned}, written=${catchup.written}, skipped=${catchup.skipped}, unmatched=${catchup.unmatched}`,
        );
      }

      while (!stopping) {
        const latestInfo = await client.getInfo();
        const count =
          typeof latestInfo.logCounts === "number" &&
          Number.isFinite(latestInfo.logCounts)
            ? latestInfo.logCounts
            : lastLogCount;

        if (count > lastLogCount) {
          const delta = count - lastLogCount;
          console.log(`New device logs: +${delta}`);
          lastLogCount = count;
          const result = await syncLatestZkRecords(client, delta);
          console.log(
            `Synced punches: written=${result.written}, skipped=${result.skipped}, unmatched=${result.unmatched}`,
          );
        } else if (count < lastLogCount) {
          lastLogCount = count;
        }

        await updateZkStatus({
          running: true,
          lastLogCount,
          lastHeartbeatAt: new Date().toISOString(),
          lastError: null,
        });

        await sleep(config.pollMs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("ZKTeco worker error:", message);
      await updateZkStatus({
        enabled: true,
        running: false,
        deviceIp: config.ip,
        devicePort: config.port,
        lastError: message,
        lastHeartbeatAt: new Date().toISOString(),
      }).catch(() => undefined);
      await client?.disconnect().catch(() => undefined);
      client = null;
      if (!stopping) await sleep(config.reconnectMs);
    }
  }

  await client?.disconnect().catch(() => undefined);
  await updateZkStatus({
    running: false,
    lastHeartbeatAt: new Date().toISOString(),
  }).catch(() => undefined);
  console.log("ZKTeco worker stopped");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
