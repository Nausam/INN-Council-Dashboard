/** A random time from 08:00 to 08:`lastMinute`. */
function randomMorningTime(lastMinute: number): string {
  const minute = Math.floor(Math.random() * (lastMinute + 1));
  return `08:${String(minute).padStart(2, "0")}`;
}

/**
 * The time a Salaam or Family leave form says the employee reported their
 * absence: a random minute from 08:00 to 08:55, filled in automatically.
 */
export function randomReportedTime(): string {
  return randomMorningTime(55);
}

export function isReportedTimeInRange(time: unknown): boolean {
  return typeof time === "string" && /^08:([0-4]\d|5[0-5])$/.test(time);
}

/** The time the office received the form: a random minute from 08:00 to 08:50. */
export function randomReceivedTime(): string {
  return randomMorningTime(50);
}

export function isReceivedTimeInRange(time: unknown): boolean {
  return typeof time === "string" && /^08:([0-4]\d|50)$/.test(time);
}
