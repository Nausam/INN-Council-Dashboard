import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

/**
 * Re-runs the mosque sync over past days so a second punch in one prayer's
 * window fills an empty next prayer (see `carryOverSecondPunches`). Lists
 * every prayer the sync would now change, marking the ones the carry-over
 * explains, and writes only with --apply. Days before punches were recorded
 * (2026-06-01) have nothing to re-match, and the rule only applies from
 * 2026-10-01, so the default range starts there.
 * Run with: npx tsx --conditions=react-server <this file> [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--apply]
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const { enumerateIsoDates, todayMaldivesIso, utcToMaldivesParts } = await import("../lib/attendance-sync/time");
  const { reconcileMosqueAttendanceDate } = await import("../lib/attendance-sync/reconcile");
  const { resolvePrayerTimesForDate, resolvePreviousDayIshaTime } = await import("../lib/attendance-sync/prayer-times");
  const { classifyPunch } = await import("../lib/attendance-sync/prayer-classifier");
  const { COLLECTIONS, getFirestoreDb } = await import("../lib/firebase/admin");

  const from = process.argv.find((arg) => arg.startsWith("--from="))?.slice(7) ?? "2026-10-01";
  const to = process.argv.find((arg) => arg.startsWith("--to="))?.slice(5) ?? todayMaldivesIso();
  const db = getFirestoreDb();

  let carried = 0;
  let other = 0;
  let written = 0;
  for (const date of enumerateIsoDates(from, to)) {
    const preview = await reconcileMosqueAttendanceDate(date, undefined, { preview: true });
    const [times, previousIsha] = await Promise.all([resolvePrayerTimesForDate(date), resolvePreviousDayIshaTime(date)]);
    const toWrite: string[] = [];
    for (const employee of preview.employees) {
      const changes = employee.prayers.filter((prayer) => prayer.skippedReason === undefined);
      if (!changes.length) continue;
      toWrite.push(employee.employeeId);
      for (const change of changes) {
        // A carried punch sits in another prayer's window by the clock.
        let note = "OTHER ";
        if (change.punchLogId && times) {
          const punch = (await db.collection(COLLECTIONS.punchLogs).doc(change.punchLogId).get()).data();
          if (punch) {
            const { localMinutes } = utcToMaldivesParts(punch.timestampUtc);
            const byClock = classifyPunch(punch.timestampUtc, localMinutes, times, previousIsha)?.prayer;
            if (byClock && byClock !== change.prayer) note = "CARRY ";
          }
        }
        if (note === "CARRY ") carried++;
        else other++;
        // Sign-ins are stored with Maldives clock time in the ISO string.
        const label = change.signInTime ? change.signInTime.slice(11, 16) : "cleared";
        console.log(`${note} ${date}  ${employee.employeeName.padEnd(24)} ${change.prayer.replace("SignInTime", "").padEnd(9)} → ${label}  late ${change.minutesLate}`);
      }
    }
    if (apply && toWrite.length) {
      const result = await reconcileMosqueAttendanceDate(date, toWrite, { preview: false });
      written += result.updatedCount;
    }
  }

  console.log(`\n${from} → ${to}: ${carried} prayers filled by a carried punch, ${other} other changes.`);
  if (apply) console.log(`Wrote ${written} attendance rows.`);
  else console.log("Dry run only. Re-run with --apply to write these changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
