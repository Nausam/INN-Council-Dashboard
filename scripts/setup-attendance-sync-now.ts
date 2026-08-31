import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { ensureMosqueAttendanceSheets } = await import(
    "../lib/attendance-sync/ensure-sheets"
  );
  const { reconcileMosqueAttendanceDate } = await import(
    "../lib/attendance-sync/reconcile"
  );
  const { todayMaldivesIso } = await import("../lib/attendance-sync/time");
  const { getAttendanceSyncDashboardStatus } = await import(
    "../lib/attendance-sync/status"
  );

  const today = todayMaldivesIso();
  console.log(`Today (Maldives): ${today}`);

  const ensure = await ensureMosqueAttendanceSheets(today, { preview: false });
  console.log("Ensure sheets:", ensure);

  const reconcile = await reconcileMosqueAttendanceDate(today, undefined, {
    preview: false,
  });
  console.log(
    `Reconcile preview: ${reconcile.updatedCount} would update, ${reconcile.conflictCount} conflicts`,
  );

  const status = await getAttendanceSyncDashboardStatus();
  console.log("Eligible today:", status.mapping.eligibleToday);
  console.log("Unmatched punches:", status.unmatchedPunches);
  console.log("Preview mode:", status.previewMode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
