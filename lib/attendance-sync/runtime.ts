/** Runtime flags for attendance sync rollout. */
export function isAttendanceSyncPreviewMode(): boolean {
  const raw = process.env.ATTENDANCE_SYNC_PREVIEW?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return process.env.ATTENDANCE_SYNC_AUTO_WRITE?.trim() !== "1";
}

export function isAttendanceSyncAutoWriteEnabled(): boolean {
  return !isAttendanceSyncPreviewMode();
}

export function isEtimeEnabled(): boolean {
  return ["1", "true", "yes"].includes(
    String(process.env.ETIME_ENABLED ?? "").toLowerCase(),
  );
}

export function getWorkerInstanceId(): string {
  return (
    process.env.ATTENDANCE_SYNC_WORKER_ID?.trim() ||
    process.env.COMPUTERNAME?.trim() ||
    process.env.HOSTNAME?.trim() ||
    "local-worker"
  );
}
