import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { BOOTSTRAP_SYNC_BY_NAME } from "../lib/attendance-sync/employee-sync";
import { withTimestamps } from "../lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "../lib/firebase/admin";
import type { EmployeeAttendanceSyncConfig, EmployeeDoc } from "../lib/firebase/types";

async function main() {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.employees).get();
  let updated = 0;

  for (const doc of snap.docs) {
    const employee = { $id: doc.id, ...doc.data() } as EmployeeDoc;
    const bootstrap = BOOTSTRAP_SYNC_BY_NAME[employee.name?.trim() ?? ""];
    if (!bootstrap) continue;

    const config: EmployeeAttendanceSyncConfig = {
      enabled: true,
      effectiveFrom: "2020-01-01",
      ...bootstrap,
    };

    await db
      .collection(COLLECTIONS.employees)
      .doc(doc.id)
      .set(
        withTimestamps({
          attendanceSync: config,
          deviceUserId: config.zkteco?.userId ?? employee.deviceUserId,
        }),
        { merge: true },
      );
    updated += 1;
    console.log(`Updated ${employee.name}`);
  }

  console.log(`Bootstrap complete. Updated ${updated} employees.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
