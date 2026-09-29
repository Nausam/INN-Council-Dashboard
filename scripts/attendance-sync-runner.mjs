import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "node:util";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logDirectory = resolve(projectDirectory, ".attendance-sync");
const logFile = resolve(logDirectory, "worker.log");
mkdirSync(logDirectory, { recursive: true });
process.chdir(projectDirectory);

function writeLog(level, args) {
  appendFileSync(
    logFile,
    `[${new Date().toISOString()}] ${level} ${format(...args)}\n`,
    "utf8",
  );
}

for (const level of ["log", "warn", "error"]) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    writeLog(level.toUpperCase(), args);
    original(...args);
  };
}

process.on("uncaughtExceptionMonitor", (error) => writeLog("FATAL", [error]));

console.log("Attendance sync process starting");
await import("./attendance-sync-worker.ts");
