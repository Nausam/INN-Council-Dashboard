import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

/**
 * Removes the Employee Profile PIN for the named employees, so they set their
 * own at their next sign-in. Lists what it finds and deletes only with --apply.
 * Run with: npx tsx --conditions=react-server scripts/reset-employee-profile-pins.ts "Name" ... [--apply]
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const names = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (!names.length) throw new Error("Give at least one employee name.");
  const { COLLECTIONS, getFirestoreDb } = await import("../lib/firebase/admin");
  const db = getFirestoreDb();

  for (const name of names) {
    const employees = await db.collection(COLLECTIONS.employees).where("name", "==", name).get();
    if (employees.size !== 1) {
      console.log(`${name}: ${employees.size} employees match, skipped`);
      continue;
    }
    const employeeId = employees.docs[0]!.id;
    const pinRef = db.collection(COLLECTIONS.employeeProfileAuth).doc(employeeId);
    const pin = await pinRef.get();
    const phones = await db.collection(COLLECTIONS.employeePushSubscriptions).where("employeeId", "==", employeeId).get();
    const created = pin.exists ? new Date(Number(pin.get("createdAt"))).toISOString() : null;
    console.log(
      `${name} (${employeeId}): ${pin.exists ? `PIN set ${created}` : "no PIN"}; ${phones.size} phone(s) with alerts on` +
        (phones.size ? ` [${phones.docs.map((doc) => `updated ${doc.get("updatedAt")}`).join(", ")}]` : ""),
    );
    if (apply && pin.exists) {
      await pinRef.delete();
      console.log(`  PIN removed`);
    }
  }
  if (!apply) console.log("Dry run. Add --apply to remove the PINs.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
