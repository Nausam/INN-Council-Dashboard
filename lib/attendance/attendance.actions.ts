"use server";

import { isCouncilAttendanceEmployee } from "@/lib/attendance/council-attendance";
import {
  fetchAllEmployees,
  submitCouncilAttendanceUpdates,
  type CouncilAttendanceSubmitItem,
} from "@/lib/firebase/hr";
import { fetchEnrichedAttendanceForDate, fetchEnrichedMosqueAttendanceForDate } from "@/lib/attendance/enrich-attendance";
import { COLLECTIONS } from "@/lib/firebase/admin";
import { withTimestamps } from "@/lib/firebase/adapters";
import { getFirestoreDb } from "@/lib/firebase/admin";
import { newDocId } from "@/lib/firebase/query";
import type { AttendanceDoc, EmployeeDoc } from "@/lib/firebase/types";
import {
  getFirstPunchByDeviceUserId,
  getFirstPunchByEmployeeName,
} from "@/lib/attendance/punch-lookup";

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
    const { ensureMosqueAttendanceSheets } = await import(
      "@/lib/attendance-sync/ensure-sheets"
    );

    const existing = await fetchEnrichedMosqueAttendanceForDate(date);
    const ensureResult = await ensureMosqueAttendanceSheets(date, {
      preview: false,
    });

    const data = await fetchEnrichedMosqueAttendanceForDate(date);

    return {
      success: true,
      alreadyExists: existing.length > 0 && ensureResult.created === 0,
      created: ensureResult.created,
      reused: ensureResult.reused,
      conflicts: ensureResult.conflicts,
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

export const resumeMosquePrayerAutomationAction = async (
  attendanceId: string,
  prayer: import("@/types").PrayerKey,
) => {
  try {
    const { resumeAutomaticPrayerSync } = await import(
      "@/lib/attendance-sync/reconcile"
    );
    const result = await resumeAutomaticPrayerSync(attendanceId, prayer);
    return { success: true as const, data: result };
  } catch (error: unknown) {
    console.error("Error resuming mosque prayer automation:", error);
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to resume automatic sync",
    };
  }
};

export const markMosquePrayerOverridesAction = async (
  attendanceId: string,
  prayers: import("@/types").PrayerKey[],
) => {
  try {
    const { markManualPrayerOverrides } = await import(
      "@/lib/attendance-sync/reconcile"
    );
    await markManualPrayerOverrides(attendanceId, prayers);
    return { success: true as const };
  } catch (error: unknown) {
    console.error("Error marking mosque prayer overrides:", error);
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark manual overrides",
    };
  }
};
