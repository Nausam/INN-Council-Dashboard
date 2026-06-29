"use server";

import { isCouncilAttendanceEmployee } from "@/lib/attendance/council-attendance";
import {
  fetchAllEmployees,
  submitCouncilAttendanceUpdates,
  type CouncilAttendanceSubmitItem,
} from "@/lib/firebase/hr";
import { fetchEnrichedAttendanceForDate, fetchEnrichedMosqueAttendanceForDate } from "@/lib/attendance/enrich-attendance";
import type { MosquePrayerTimes } from "@/lib/attendance/mosque-prefill";
import { COLLECTIONS } from "@/lib/firebase/admin";
import { withTimestamps } from "@/lib/firebase/adapters";
import { getFirestoreDb } from "@/lib/firebase/admin";
import { newDocId } from "@/lib/firebase/query";
import type { AttendanceDoc, EmployeeDoc } from "@/lib/firebase/types";
import {
  getFirstPunchByDeviceUserId,
  getFirstPunchByEmployeeName,
} from "@/lib/attendance/punch-lookup";
import { getInnamaadhooFor } from "@/lib/salat";

async function resolveMosquePrayerTimes(
  date: string,
): Promise<MosquePrayerTimes | null> {
  try {
    const salat = getInnamaadhooFor(date);
    if (salat?.times) {
      return {
        fathisTime: salat.times.fathisTime,
        mendhuruTime: salat.times.mendhuruTime,
        asuruTime: salat.times.asuruTime,
        maqribTime: salat.times.maqribTime,
        ishaTime: salat.times.ishaTime,
      };
    }
  } catch {
    /* fall through to Firestore */
  }

  const { fetchPrayerTimesByDate } = await import("@/lib/firebase/hr");
  const fetched = await fetchPrayerTimesByDate(date);
  if (!fetched) return null;

  return {
    fathisTime: fetched.fathisTime,
    mendhuruTime: fetched.mendhuruTime,
    asuruTime: fetched.asuruTime,
    maqribTime: fetched.maqribTime,
    ishaTime: fetched.ishaTime,
  };
}

function filterMosqueAssistants(employees: EmployeeDoc[]): EmployeeDoc[] {
  return employees.filter(
    (e) =>
      (e.designation === "Council Assistant" || e.designation === "Imam") &&
      e.section === "Mosque",
  );
}

export const fetchAttendanceForDateAction = async (date: string) => {
  try {
    const data = await fetchEnrichedAttendanceForDate(date);
    return { success: true, data };
  } catch (error: unknown) {
    console.error("Error fetching attendance:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch attendance",
    };
  }
};

export const fetchAllEmployeesAction = async () => {
  try {
    const data = await fetchAllEmployees();
    return { success: true, data };
  } catch (error: unknown) {
    console.error("Error fetching employees:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch employees",
    };
  }
};

export const createAttendanceForEmployeesAction = async (
  date: string,
  employees: EmployeeDoc[],
) => {
  try {
    const filteredEmployees = employees.filter(isCouncilAttendanceEmployee);

    const db = getFirestoreDb();
    const attendanceEntries: Array<
      Omit<AttendanceDoc, "$id" | "$createdAt" | "$updatedAt">
    > = await Promise.all(
      filteredEmployees.map(async (employee) => {
        const firstPunch = employee.deviceUserId?.trim()
          ? await getFirstPunchByDeviceUserId(date, employee.deviceUserId.trim())
          : await getFirstPunchByEmployeeName(date, employee.name);

        return {
          employeeId: employee.$id,
          date,
          signInTime: firstPunch,
          leaveType: null,
          minutesLate: 0,
          previousLeaveType: null,
          leaveDeducted: false,
        };
      }),
    );

    await Promise.all(
      attendanceEntries.map(async (entry) => {
        const id = newDocId();
        await db
          .collection(COLLECTIONS.attendance)
          .doc(id)
          .set(withTimestamps(entry as Record<string, unknown>, true));
      }),
    );

    return { success: true, data: attendanceEntries };
  } catch (error: unknown) {
    console.error("Error creating attendance:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create attendance",
    };
  }
};

export const createAttendanceForEmployeesActionLegacy = async (
  date: string,
  employees: EmployeeDoc[],
) => createAttendanceForEmployeesAction(date, employees);

export const submitCouncilAttendanceAction = async (
  items: CouncilAttendanceSubmitItem[],
) => {
  try {
    await submitCouncilAttendanceUpdates(items);
    return { success: true as const };
  } catch (error: unknown) {
    console.error("Error submitting council attendance:", error);
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update attendance",
    };
  }
};

export const syncAttendanceForDateAction = async (
  date: string,
  options: { syncDevice?: boolean } = {},
) => {
  try {
    if (options.syncDevice) {
      const { syncZkDateRange } = await import("@/lib/zk/sync-service");
      await syncZkDateRange(date, date);
    }

    const { syncAttendanceForDate } = await import("@/lib/firebase/hr");
    const { synced, added } = await syncAttendanceForDate(date);
    return {
      success: true,
      synced,
      added,
      updated: synced + added,
      changed: synced + added,
    };
  } catch (error: unknown) {
    console.error("Error syncing attendance:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to sync attendance",
    };
  }
};

export const fetchMosqueAttendanceForDateAction = async (date: string) => {
  try {
    const data = await fetchEnrichedMosqueAttendanceForDate(date);
    return { success: true, data };
  } catch (error: unknown) {
    console.error("Error fetching mosque attendance:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch mosque attendance",
    };
  }
};

export const generateMosqueAttendanceAction = async (date: string) => {
  try {
    const {
      createMosqueAttendanceForEmployees,
      fetchAllEmployees,
    } = await import("@/lib/firebase/hr");

    const existing = await fetchEnrichedMosqueAttendanceForDate(date);
    if (existing.length > 0) {
      return {
        success: true,
        alreadyExists: true as const,
        data: existing,
      };
    }

    const prayerTimes = await resolveMosquePrayerTimes(date);
    const employees = await fetchAllEmployees();
    const mosqueAssistants = filterMosqueAssistants(employees);

    if (mosqueAssistants.length === 0) {
      return {
        success: false,
        error: "No mosque staff found (Council Assistant or Imam in Mosque section).",
      };
    }

    await createMosqueAttendanceForEmployees(
      date,
      mosqueAssistants,
      prayerTimes,
    );

    const data = await fetchEnrichedMosqueAttendanceForDate(date);

    return {
      success: true,
      alreadyExists: false as const,
      prayerTimesFound: Boolean(prayerTimes),
      data,
    };
  } catch (error: unknown) {
    console.error("Error generating mosque attendance:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate mosque attendance",
    };
  }
};
