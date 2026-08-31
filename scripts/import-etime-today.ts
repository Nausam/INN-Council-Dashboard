import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { importEtimePunches } = await import("../lib/attendance-sync/import-etime");
  const { todayMaldivesIso } = await import("../lib/attendance-sync/time");
  const { testEtimeConnection } = await import("../lib/attendance-sync/import-etime");

  const test = await testEtimeConnection();
  console.log("test:", test);

  const date = todayMaldivesIso();
  console.log("importing", date);
  const result = await importEtimePunches({
    from: date,
    to: date,
    reconcile: true,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
