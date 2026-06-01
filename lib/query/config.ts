/** Default stale time — data is fresh for 2 minutes before background refetch. */
export const QUERY_STALE_TIME = 2 * 60 * 1000;

/** Keep unused cache for 10 minutes. */
export const QUERY_GC_TIME = 10 * 60 * 1000;

/** Short stale time for frequently edited attendance data. */
export const QUERY_STALE_TIME_ATTENDANCE = 30 * 1000;
