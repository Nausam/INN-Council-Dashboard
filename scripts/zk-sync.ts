import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const from = readArg("from") ?? todayIso();
  const to = readArg("to") ?? from;
  const { getRequiredZkConfig } = await import("../lib/zk/config");
  const { syncZkDateRange } = await import("../lib/zk/sync-service");

  const config = getRequiredZkConfig();
  process.env.TZ = config.timezone;

  const result = await syncZkDateRange(from, to);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
