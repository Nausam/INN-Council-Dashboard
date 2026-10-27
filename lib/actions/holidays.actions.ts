"use server";

import { getEmployeeProfileSessionId } from "@/lib/auth/employee-profile-session";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { fetchHolidayCalendar } from "@/lib/firebase/hr";

/**
 * A month's public holidays from the Holiday Calendar, for calendars staff
 * and employees look at. Marking them stays on the Admin page.
 */
export async function getHolidayDates(month: string): Promise<string[]> {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  if (!(await getSessionAuthProfile()) && !getEmployeeProfileSessionId()) return [];
  return (await fetchHolidayCalendar(month))?.holidayDates ?? [];
}
