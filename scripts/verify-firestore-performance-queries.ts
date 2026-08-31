/**
 * Read-only smoke tests for indexed query paths used by performance-sensitive pages.
 * Usage: npm run verify:perf-queries
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { COLLECTIONS, getFirestoreDb } from "../lib/firebase/admin";
import { listDocuments } from "../lib/firebase/repository";

const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
const year = today.slice(0, 4);

const tests: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: "attendance by date",
    run: async () => {
      await listDocuments(COLLECTIONS.attendance, {
        where: [["date", "==", today]],
        limit: 5,
      });
    },
  },
  {
    name: "mosque attendance by date",
    run: async () => {
      await listDocuments(COLLECTIONS.mosqueAttendance, {
        where: [["date", "==", today]],
        limit: 5,
      });
    },
  },
  {
    name: "correspondence status ordered by receivedAt",
    run: async () => {
      await listDocuments(COLLECTIONS.correspondence, {
        where: [["status", "==", "pending"]],
        orderBy: [{ field: "receivedAt", direction: "desc" }],
        limit: 5,
      });
    },
  },
  {
    name: "punch logs by device and timestamp range",
    run: async () => {
      await listDocuments(COLLECTIONS.punchLogs, {
        where: [
          ["deviceUserId", "==", "__smoke_test__"],
          ["timestamp", ">=", `${today}T00:00:00.000Z`],
          ["timestamp", "<", `${today}T23:59:59.999Z`],
        ],
        orderBy: [{ field: "timestamp", direction: "asc" }],
        limit: 1,
      });
    },
  },
  {
    name: "waste invoices by service and period",
    run: async () => {
      await listDocuments(COLLECTIONS.invoices, {
        where: [
          ["serviceType", "==", "WASTE"],
          ["periodMonth", "==", month],
        ],
        orderBy: [{ field: "issueDate", direction: "desc" }],
        limit: 5,
      });
    },
  },
  {
    name: "land statements by month",
    run: async () => {
      await listDocuments(COLLECTIONS.landStatements, {
        where: [["monthKey", "==", month]],
        limit: 5,
      });
    },
  },
  {
    name: "salary slips by period",
    run: async () => {
      await listDocuments(COLLECTIONS.salarySlips, {
        where: [["periodLabel", "==", month]],
        limit: 5,
      });
    },
  },
  {
    name: "invoice number prefix",
    run: async () => {
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
];

async function main() {
  getFirestoreDb();
  let failed = 0;

  for (const test of tests) {
    try {
      await test.run();
      console.log(`[OK] ${test.name}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[FAIL] ${test.name}: ${message}`);
    }
  }

  console.log(`${tests.length - failed}/${tests.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
