import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

/**
 * Clears late minutes already stored for prayers that `isLatenessExempt`
 * now excuses (for example Hawwa Luiza's Isha from 2026-10-16). The sync
 * sets these to 0 for new punches; this fixes the rows written before the
 * rule existed. Lists every change and writes only with --apply.
 * Run with: npx tsx --conditions=react-server <this file> [--apply]
 */
const TARGETS = [{ name: "Hawwa Luiza", from: "2026-10-16" }];

async function main() {
  const apply = process.argv.includes("--apply");
  const { isLatenessExempt } = await import("../lib/attendance-sync/employee-sync");
  const { MOSQUE_PRAYERS } = await import("../lib/attendance-sync/types");
  const { COLLECTIONS, getFirestoreDb } = await import("../lib/firebase/admin");
  const { withTimestamps } = await import("../lib/firebase/adapters");
  const db = getFirestoreDb();

  let changed = 0;
  for (const target of TARGETS) {
    const employees = await db.collection(COLLECTIONS.employees).where("name", "==", target.name).get();
    if (employees.empty) {
      console.log(`No employee named ${target.name}.`);
      continue;
    }

    for (const employee of employees.docs) {
      const rows = await db
        .collection(COLLECTIONS.mosqueAttendance)
        .where("employeeId", "==", employee.id)
        .where("date", ">=", target.from)
        .get();

      for (const row of rows.docs.sort((a, b) => String(a.get("date")).localeCompare(String(b.get("date"))))) {
        const date = String(row.get("date")).slice(0, 10);
        const updates: Record<string, number> = {};
        for (const prayer of MOSQUE_PRAYERS) {
          const lateKey = prayer.replace("SignInTime", "MinutesLate");
          const late = Number(row.get(lateKey) ?? 0);
          if (late > 0 && isLatenessExempt(target.name, prayer, date)) {
            updates[lateKey] = 0;
            const signIn = String(row.get(prayer) ?? "").slice(11, 16) || "-";
            console.log(`${date}  ${target.name.padEnd(16)} ${prayer.replace("SignInTime", "").padEnd(9)} in ${signIn}  late ${late} → 0`);
          }
        }
        if (!Object.keys(updates).length) continue;
        changed += Object.keys(updates).length;
        if (apply) await row.ref.update(withTimestamps(updates));
      }
    }
  }

  console.log(`\n${changed} late prayer(s) to clear.`);
  console.log(apply ? "Written." : "Dry run only. Re-run with --apply to write these changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
