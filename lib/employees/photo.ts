/** R2 prefix for employee profile photos. Keys look like employee-photos/{employeeId}/{uuid}.jpg */
export const EMPLOYEE_PHOTO_PREFIX = "employee-photos/";

/** Largest upload accepted after the browser has resized the photo. */
export const EMPLOYEE_PHOTO_MAX_BYTES = 900 * 1024;

/**
 * URL for an employee's profile photo, or undefined when they have none.
 * The key is part of the query string so a new upload is never served from a
 * cached copy of the old photo.
 */
export function employeePhotoUrl(
  employeeId: string | undefined | null,
  photoKey: string | undefined | null,
): string | undefined {
  if (!employeeId || !photoKey) return undefined;
  const version = photoKey.split("/").pop() ?? photoKey;
  return `/api/employee-photos/${encodeURIComponent(employeeId)}?v=${encodeURIComponent(version)}`;
}

/** Employee ID encoded in a photo key, or null when the key isn't a photo key. */
export function employeeIdFromPhotoKey(key: string): string | null {
  if (!key.startsWith(EMPLOYEE_PHOTO_PREFIX)) return null;
  const employeeId = key.slice(EMPLOYEE_PHOTO_PREFIX.length).split("/")[0];
  return employeeId || null;
}
