import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  const from = process.argv.find((a) => a.startsWith("--from="))?.slice(7) ?? "2026-06-01";
  const toArg = process.argv.find((a) => a.startsWith("--to="))?.slice(5);
  const skipZk = process.argv.includes("--skip-zk");
  const skipEtime = process.argv.includes("--skip-etime");

  const { todayMaldivesIso, enumerateIsoDates } = await import(
    "../lib/attendance-sync/time"
  );
  const { ensureMosqueAttendanceSheets } = await import(
    "../lib/attendance-sync/ensure-sheets"
  );
  const { reconcileMosqueAttendanceDate } = await import(
    "../lib/attendance-sync/reconcile"
  );
  const { importEtimePunches } = await import("../lib/attendance-sync/import-etime");
  const { importZktecoFromDeviceRange } = await import(
    "../lib/attendance-sync/import-zkteco"
  );

  const to = toArg ?? todayMaldivesIso();
  const dates = enumerateIsoDates(from, to);
  console.log(`Backfill ${from} → ${to} (${dates.length} days)`);
  console.log(`skipZk=${skipZk} skipEtime=${skipEtime}`);

  if (!skipEtime) {
    console.log("\n=== eTime import ===");
    // Import in ~14-day chunks to reduce timeout risk.
    for (let i = 0; i < dates.length; i += 14) {
      const chunk = dates.slice(i, i + 14);
      const chunkFrom = chunk[0]!;
      const chunkTo = chunk[chunk.length - 1]!;
      try {
        const result = await importEtimePunches({
          from: chunkFrom,
          to: chunkTo,
          reconcile: false,
        });
        console.log(
          `${chunkFrom}→${chunkTo}: scanned=${result.scanned} written=${result.written} skipped=${result.skipped} unmatched=${result.unmatched}`,
        );
      } catch (error) {
        console.error(
          `${chunkFrom}→${chunkTo}: eTime failed:`,
          error instanceof Error ? error.message : error,
        );
        // Fall back to day-by-day for this chunk.
        for (const date of chunk) {
          try {
            const result = await importEtimePunches({
              from: date,
              to: date,
              reconcile: false,
            });
            console.log(
              `  ${date}: written=${result.written} scanned=${result.scanned}`,
            );
          } catch (dayError) {
            console.error(
              `  ${date}:`,
              dayError instanceof Error ? dayError.message : dayError,
            );
          }
        }
      }
    }
  }

  if (!skipZk) {
    console.log("\n=== ZKTeco import (full device pull, filtered to range) ===");
    try {
      const result = await importZktecoFromDeviceRange(from, to);
      console.log("ZK result:", result);
    } catch (error) {
      console.error(
        "ZK import failed (continuing with existing punch_logs):",
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("\n=== Ensure blank sheets + reconcile ===");
  let ensured = 0;
  let reconciled = 0;
  for (const date of dates) {
    const ensure = await ensureMosqueAttendanceSheets(date, { preview: false });
    ensured += ensure.created;
    const reconcile = await reconcileMosqueAttendanceDate(date, undefined, {
      preview: false,
    });
    reconciled += reconcile.updatedCount;
    console.log(
      `${date}: created=${ensure.created} reused=${ensure.reused} conflicts=${ensure.conflicts.length} reconcileUpdated=${reconcile.updatedCount}`,
    );
  }

  console.log("\nDone.");
  console.log({ days: dates.length, sheetsCreated: ensured, reconcileUpdates: reconciled });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
