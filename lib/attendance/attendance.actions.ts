/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { Query } from "node-appwrite";
import { createSessionClient } from "@/lib/appwrite";
import { appwriteConfig } from "@/lib/appwrite/appwrite";
import type { AttendanceDoc, EmployeeDoc } from "@/lib/appwrite/appwrite";

// Helper to get first punch for an employee on a date
const getFirstPunchCreatedAtForEmployee = async (
  localDate: string,
  employeeName: string
): Promise<string | null> => {
  const { databases } = await createSessionClient();

  const { startUtc, endUtc } = localDayRangeToUtc(localDate);
  const nameNorm = normalizeHumanName(employeeName);

  try {
    // Try normalized name first
    let res = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.punchLogsRawCollectionId,
      [
        Query.equal("empNameNorm", nameNorm),
        Query.greaterThanEqual("timestamp", startUtc),
        Query.lessThan("timestamp", endUtc),
        Query.orderAsc("timestamp"),
        Query.limit(1),
      ]
    );
    if (res.documents.length) return res.documents[0].timestamp as string;

    // Fallback to exact name
    res = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.punchLogsRawCollectionId,
      [
        Query.equal("empName", employeeName),
        Query.greaterThanEqual("timestamp", startUtc),
        Query.lessThan("timestamp", endUtc),
        Query.orderAsc("timestamp"),
        Query.limit(1),
      ]
    );
    if (res.documents.length) return res.documents[0].timestamp as string;

    return null;
  } catch (error) {
    console.error("Error fetching punch logs:", error);
    return null;
  }
};

// Utility functions
const normalizeHumanName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const localDayRangeToUtc = (yyyyMmDd: string) => {
  const startLocal = new Date(`${yyyyMmDd}T00:00:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
  const startUtc = new Date(
    startLocal.getTime() - startLocal.getTimezoneOffset() * 60000
  ).toISOString();
  const endUtc = new Date(
    endLocal.getTime() - endLocal.getTimezoneOffset() * 60000
  ).toISOString();
  return { startUtc, endUtc };
};

// Server Actions
export const fetchAttendanceForDateAction = async (date: string) => {
  try {
    const { databases } = await createSessionClient();

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.attendanceCollectionId,
      [Query.equal("date", date)]
    );

    return { success: true, data: response.documents };
  } catch (error: any) {
    console.error("Error fetching attendance:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch attendance",
    };
  }
};

export const fetchAllEmployeesAction = async () => {
  try {
    const { databases } = await createSessionClient();

    const results: EmployeeDoc[] = [];
    const pageSize = 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.employeesCollectionId,
        [Query.limit(pageSize), Query.offset(offset)]
      );

      results.push(...(res.documents as EmployeeDoc[]));
      hasMore = res.documents.length === pageSize;
      offset += pageSize;
    }

    return { success: true, data: results };
  } catch (error: any) {
    console.error("Error fetching employees:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch employees",
    };
  }
};

export const createAttendanceForEmployeesAction = async (
  date: string,
  employees: EmployeeDoc[]
) => {
  try {
    const { databases } = await createSessionClient();

    // Exclude mosque section
    const filteredEmployees = employees.filter((e) => {
      const sec =
        typeof e.section === "string" ? e.section.trim().toLowerCase() : "";
      return sec !== "mosque";
    });

    // Build entries with real sign-in times
    const attendanceEntries = await Promise.all(
      filteredEmployees.map(async (employee) => {
        const firstPunch = await getFirstPunchCreatedAtForEmployee(
          date,
          employee.name
        );

        return {
          employeeId: employee.$id,
          date,
          signInTime: firstPunch,
          leaveType: null,
          minutesLate: 0,
          previousLeaveType: null,
          leaveDeducted: false,
        };
      })
    );

    // Create all documents
    const createdDocs = await Promise.all(
      attendanceEntries.map((entry) =>
        databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.attendanceCollectionId,
          crypto.randomUUID(), // Use crypto.randomUUID() in server actions
          entry
        )
      )
    );

    return { success: true, data: createdDocs };
  } catch (error: any) {
    console.error("Error creating attendance:", error);
    return {
      success: false,
      error: error.message || "Failed to create attendance",
    };
  }
};

export const syncAttendanceForDateAction = async (date: string) => {
  try {
    const { databases } = await createSessionClient();

    // Get attendance rows for the day
    const attendanceRes = await fetchAttendanceForDateAction(date);
    if (!attendanceRes.success || !attendanceRes.data) {
      return { success: false, error: "Failed to fetch attendance" };
    }

    const rows = attendanceRes.data as AttendanceDoc[];
    if (rows.length === 0) return { success: true, updated: 0 };

    // Get all employees
    const employeesRes = await fetchAllEmployeesAction();
    if (!employeesRes.success || !employeesRes.data) {
      return { success: false, error: "Failed to fetch employees" };
    }

    const nameById = new Map<string, string>();
    for (const e of employeesRes.data) {
      nameById.set(e.$id, e.name);
    }

    let changed = 0;

    await Promise.all(
      rows.map(async (row) => {
        const empName = nameById.get(row.employeeId);
        if (!empName) return;

        const earliest = await getFirstPunchCreatedAtForEmployee(date, empName);
        if (!earliest) return;

        const current = row.signInTime
          ? new Date(row.signInTime).getTime()
          : null;
        const earliestMs = new Date(earliest).getTime();

        if (current === null || earliestMs < current) {
          await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.attendanceCollectionId,
            row.$id,
            { signInTime: earliest }
          );
          changed += 1;
        }
      })
    );

    return { success: true, updated: changed };
  } catch (error: any) {
    console.error("Error syncing attendance:", error);
    return {
      success: false,
      error: error.message || "Failed to sync attendance",
    };
  }
};
