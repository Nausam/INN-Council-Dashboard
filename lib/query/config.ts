/** Default stale time — list/reference data stays fresh for 5 minutes. */
export const QUERY_STALE_TIME = 5 * 60 * 1000;

/** Keep unused cache for 30 minutes so page switches feel instant. */
export const QUERY_GC_TIME = 30 * 60 * 1000;

/** Short stale time for frequently edited attendance data. */
export const QUERY_STALE_TIME_ATTENDANCE = 30 * 1000;
