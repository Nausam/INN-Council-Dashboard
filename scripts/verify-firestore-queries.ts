/**
 * Smoke-test Firestore query patterns that previously required composite indexes.
 * Usage: npx tsx scripts/verify-firestore-queries.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { listDocuments, listAllDocuments } from "../lib/firebase/repository";
import { COLLECTIONS } from "../lib/firebase/admin";
import {
  createAttendanceForEmployeesAction,
  fetchAllEmployeesAction,
} from "../lib/attendance/attendance.actions";
import {
  fetchMosqueDailyAttendanceForMonth,
  listSalarySlipsByRecordCard,
} from "../lib/firebase/hr";

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "salary slips by record card",
    run: async () => {
      await listSalarySlipsByRecordCard("88792");
    },
  },
  {
    name: "mosque daily attendance (employee + month filter)",
    run: async () => {
      const month = new Date().toISOString().slice(0, 7);
      const employees = await fetchAllEmployeesAction();
      const id = (employees.data as { $id: string }[])?.[0]?.$id;
      if (id) await fetchMosqueDailyAttendanceForMonth(month, id);
    },
  },
  {
    name: "invoices prefix + order",
    run: async () => {
      const year = String(new Date().getFullYear());
      await listDocuments(COLLECTIONS.invoices, {
        where: [
          ["serviceType", "==", "WASTE"],
          ["invoiceNo", ">=", `WM-${year}-`],
          ["invoiceNo", "<", `WM-${year}-\uf8ff`],
        ],
        orderBy: [{ field: "invoiceNo", direction: "desc" }],
        limit: 1,
      });
    },
  },
  {
    name: "land statements lease + order",
    run: async () => {
      const leases = await listAllDocuments(COLLECTIONS.landLeases, {
        orderBy: [{ field: "$createdAt", direction: "desc" }],
      });
      if (leases[0]) {
        await listAllDocuments(COLLECTIONS.landStatements, {
          where: [["leaseId", "==", leases[0].$id]],
          orderBy: [{ field: "monthKey", direction: "asc" }],
        });
      }
    },
  },
  {
    name: "correspondence reference prefix + order",
    run: async () => {
      const now = new Date();
      const prefix = `DOC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      await listDocuments(COLLECTIONS.correspondence, {
        where: [
          ["referenceNumber", ">=", prefix],
          ["referenceNumber", "<", `${prefix}\uf8ff`],
        ],
        orderBy: [{ field: "referenceNumber", direction: "desc" }],
        limit: 1,
      });
    },
  },
  {
    name: "generate council attendance",
    run: async () => {
      const date = new Date().toISOString().split("T")[0]!;
      const employees = await fetchAllEmployeesAction();
      if (!employees.success || !employees.data?.length) return;
      const result = await createAttendanceForEmployeesAction(
        date,
        employees.data as never,
      );
      if (!result.success) throw new Error(result.error);
    },
  },
];

async function main() {
  console.log("=== Firestore query smoke tests ===\n");
  let failed = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`[OK] ${t.name}`);
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[FAIL] ${t.name}: ${msg}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
