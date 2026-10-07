import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

/**
 * Recomputes `minutesLate` on every office attendance row from its saved
 * sign-in time, using the current 08:30 cutoff for all employees.
 *
 * Dry run by default; pass --apply to write the changes.
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const { COLLECTIONS, getFirestoreDb } = await import("../lib/firebase/admin");
  const { withTimestamps } = await import("../lib/firebase/adapters");
  const { computeCouncilMinutesLate } = await import(
    "../lib/attendance/council-lateness"
  );

  const db = getFirestoreDb();
  const snapshot = await db.collection(COLLECTIONS.attendance).get();

  const changes: Array<{ id: string; date: string; from: number; to: number }> = [];
  // Rows whose stored value is lower than the recomputed one were deliberately
  // left at 0 (old imports, cleared days); report them instead of adding lateness.
  const increases: typeof changes = [];
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const row = doc.data();
    // Older imported rows store the date as a full ISO timestamp.
    const date = typeof row.date === "string" ? row.date.slice(0, 10) : "";
    const signInTime = typeof row.signInTime === "string" ? row.signInTime : "";
    if (!date || !signInTime || Number.isNaN(new Date(signInTime).getTime())) {
      skipped++;
      continue;
    }

    const current = Number(row.minutesLate ?? 0);
    const next = computeCouncilMinutesLate(signInTime, date);
    if (next < current) {
      changes.push({ id: doc.id, date, from: current, to: next });
    } else if (next > current) {
      increases.push({ id: doc.id, date, from: current, to: next });
    }
  }

  const byDate = (a: { date: string; id: string }, b: { date: string; id: string }) =>
    a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
  changes.sort(byDate);
  increases.sort(byDate);
  for (const change of changes) {
    console.log(`${change.date}  ${change.id}  ${change.from} → ${change.to}`);
  }
  if (increases.length > 0) {
    console.log("\nNot changed (stored value is lower than recomputed):");
    for (const change of increases) {
      console.log(`${change.date}  ${change.id}  ${change.from} (would be ${change.to})`);
    }
  }
  console.log(
    `\nScanned ${snapshot.size} rows, ${changes.length} to update, ${increases.length} left as-is, ${skipped} without a sign-in time.`,
  );

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write these changes.");
    return;
  }

  for (let i = 0; i < changes.length; i += 400) {
    const batch = db.batch();
    for (const change of changes.slice(i, i + 400)) {
      batch.update(
        db.collection(COLLECTIONS.attendance).doc(change.id),
        withTimestamps({ minutesLate: change.to }),
      );
    }
    await batch.commit();
  }
  console.log(`Updated ${changes.length} rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
