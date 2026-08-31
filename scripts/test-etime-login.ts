import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { testEtimeConnection } = await import("../lib/attendance-sync/import-etime");
  const result = await testEtimeConnection();
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
