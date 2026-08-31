import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { testZkConnection } = await import("../lib/zk/sync-service");
  const { importZktecoFromDeviceRange } = await import(
    "../lib/attendance-sync/import-zkteco"
  );
  const { todayMaldivesIso } = await import("../lib/attendance-sync/time");
  const { reconcileMosqueAttendanceDate } = await import(
    "../lib/attendance-sync/reconcile"
  );

  console.log("Testing ZKTeco connection...");
  const test = await testZkConnection();
  console.log("ZK test OK:", {
    serial: test.serial,
    logCount: test.logCount,
    userCount: test.userCount,
  });

  const today = todayMaldivesIso();
  console.log(`Importing ZK punches for ${today}...`);
  const imported = await importZktecoFromDeviceRange(today, today);
  console.log("Import result:", imported);

  const reconcile = await reconcileMosqueAttendanceDate(today, undefined, {
    preview: false,
  });
  console.log(
    `Reconcile: ${reconcile.updatedCount} employees updated, ${reconcile.conflictCount} conflicts`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
