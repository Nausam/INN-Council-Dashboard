import { MosqueAttendanceRecord, PrayerKey } from "@/types";
import {
  Account,
  Avatars,
  Client,
  Databases,
  ID,
  ImageGravity,
  Query,
  Storage,
  Permission,
  Role,
  Models,
} from "appwrite";
import axios from "axios";

export const appwriteConfig = {
  endpoint: "https://cloud.appwrite.io/v1",
  projectId: "66f134a7001102e81a6d",
  databaseId: "66f135a0002dfd91853a",
  employeesCollectionId: "6708bd860020db2f8598",
  attendanceCollectionId: "6701373d00373ea0dd09",
  mosqueAttendanceCollectionId: "6748841b0005589c9c31",
  prayerTimesCollectionId: "6749573400305f49417b",
};

const {
  endpoint,
  projectId,
  databaseId,
  employeesCollectionId,
  attendanceCollectionId,
} = appwriteConfig;

const client = new Client();

client.setEndpoint(endpoint).setProject(projectId);

const account = new Account(client);
const avatars = new Avatars(client);
const databases = new Databases(client);

// Fetch attendance for a given date
export const fetchAttendanceForDate = async (date: string) => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.attendanceCollectionId,
      [Query.equal("date", date)]
    );
    return response.documents;
  } catch (error) {
    console.error("Error fetching attendance:", error);
    throw error;
  }
};

// Fetch all employees
export const fetchAllEmployees = async () => {
  try {
    const employeesResponse = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.employeesCollectionId
    );
    return employeesResponse.documents;
  } catch (error) {
    console.error("Error fetching employees:", error);
    throw error;
  }
};

// Create attendance for all employees
export const createAttendanceForEmployees = async (
  date: string,
  employees: any[]
) => {
  try {
    const defaultSignInTime = new Date(`${date}T08:00:00Z`).toISOString();

    const attendanceEntries = employees.map((employee: any) => ({
      employeeId: employee.$id,
      date,
      signInTime: defaultSignInTime,
      leaveType: null,
      minutesLate: 0,
    }));

    await Promise.all(
      attendanceEntries.map(async (entry) => {
        await databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.attendanceCollectionId,
          ID.unique(),
          entry
        );
      })
    );

    return attendanceEntries;
  } catch (error) {
    console.error("Error creating attendance:", error);
    throw error;
  }
};

// Update attendance record
export const updateAttendanceRecord = async (
  attendanceId: string,
  updates: any
) => {
  try {
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.attendanceCollectionId,
      attendanceId,
      {
        // Send only the updated fields, avoid unnecessary fields
        signInTime: updates.signInTime,
        leaveType: updates.leaveType,
        minutesLate: updates.minutesLate,
        leaveDeducted: updates.leaveDeducted,
        previousLeaveType: updates.previousLeaveType,
      }
    );
  } catch (error) {
    console.error("Error updating attendance:", error);
    throw error;
  }
};

// Fetch attendance for the month
export const fetchAttendanceForMonth = async (month: string) => {
  const startOfMonth = new Date(`${month}-01T00:00:00Z`).toISOString();
  const endOfMonth = new Date(
    new Date(`${month}-01T00:00:00Z`).setMonth(
      new Date(`${month}-01`).getMonth() + 1
    )
  ).toISOString();

  let allAttendanceRecords: any[] = [];
  let hasMore = true;
  let offset = 0;

  const limit = 100; // Appwrite limit for pagination

  try {
    while (hasMore) {
      const response = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.attendanceCollectionId,
        [
          Query.greaterThanEqual("date", startOfMonth),
          Query.lessThanEqual("date", endOfMonth),
          Query.limit(limit),
          Query.offset(offset),
        ]
      );

      allAttendanceRecords = allAttendanceRecords.concat(response.documents);

      // If we get fewer documents than the limit, it means we're done
      if (response.documents.length < limit) {
        hasMore = false;
      } else {
        offset += limit; // Move to the next batch
      }
    }

    return allAttendanceRecords;
  } catch (error) {
    console.error("Error fetching attendance for the month:", error);
    throw error;
  }
};

// Create employee record
export const createEmployeeRecord = async (employeeData: any) => {
  try {
    const response = await databases.createDocument(
      databaseId,
      employeesCollectionId,
      ID.unique(),
      employeeData
    );
    console.log("DATA : ", employeeData);
    return response;
  } catch (error) {
    console.error("Error creating employee:", error);
    throw error;
  }
};

// Fetch employee by ID
export const fetchEmployeeById = async (employeeId: string) => {
  try {
    const response = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.employeesCollectionId,
      employeeId
    );
    return response;
  } catch (error) {
    console.error("Error fetching employee:", error);
    throw error;
  }
};

// Fetch the employee's current leave and update it by deducting one
export const deductLeave = async (
  employeeId: string,
  leaveType: string,
  restore: boolean = false
) => {
  try {
    // Fetch the employee document
    const employee = await fetchEmployeeById(employeeId);

    // Determine the leave balance for the leave type
    const leaveBalance = employee[leaveType];

    // Adjust the leave count (restore or deduct)
    const updatedLeaveBalance = restore ? leaveBalance + 1 : leaveBalance - 1;

    // Ensure leave count doesn't drop below zero
    if (updatedLeaveBalance < 0 && !restore) {
      throw new Error("Insufficient leave balance");
    }

    // Only pass necessary fields to update
    const updates = {
      [leaveType]: updatedLeaveBalance, // Only pass the leave type being updated
    };

    await databases.updateDocument(
      databaseId,
      employeesCollectionId,
      employeeId,
      updates
    );

    console.log("Leave deducted successfully for employee", employeeId);
  } catch (error) {
    console.error("Error updating employee leave:", error);
    throw error;
  }
};

// Update employee's leave balance
export const updateEmployeeLeaveBalance = async (
  employeeId: string,
  updatedLeaveData: any
) => {
  try {
    await databases.updateDocument(
      databaseId,
      employeesCollectionId,
      employeeId,
      updatedLeaveData
    );
  } catch (error) {
    console.error("Error updating employee leave:", error);
  }
};

// Update Employee
export const updateEmployeeRecord = async (
  employeeId: string,
  formData: any
) => {
  try {
    const updatedEmployee = await databases.updateDocument(
      databaseId,
      employeesCollectionId,
      employeeId,
      formData
    );

    return updatedEmployee;
  } catch (error) {
    console.error("Error updating employee record:", error);
    throw new Error("Failed to update employee record.");
  }
};

// Delete all attendances for a specific date
export const deleteAttendancesByDate = async (date: string): Promise<void> => {
  try {
    // Query the documents by date field
    const response = await databases.listDocuments(
      databaseId,
      attendanceCollectionId,
      [Query.equal("date", date)]
    );

    const attendanceRecords = response.documents;

    if (attendanceRecords.length === 0) {
      console.log(`No attendance records found for date: ${date}`);
      return; // No records to delete
    }

    // Delete each attendance record
    const deletePromises = attendanceRecords.map((record) =>
      databases.deleteDocument(databaseId, attendanceCollectionId, record.$id)
    );

    // Wait for all delete operations to complete
    await Promise.all(deletePromises);

    console.log(`Successfully deleted all attendances for ${date}`);
  } catch (error) {
    console.error(`Error deleting attendance records for ${date}:`, error);
    throw new Error(`Failed to delete attendance records for ${date}`);
  }
};

// MOSQUE ASSISTANT ATTENDANCE

// Fetch employees by designation
export const fetchMosqueAttendanceForDate = async (date: string) => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.mosqueAttendanceCollectionId,
      [Query.equal("date", date)]
    );
    return response.documents;
  } catch (error) {
    console.error("Error fetching mosque attendance:", error);
    throw error;
  }
};

// CREATE MOSQUE ASSISTANTS ATTENDANCE
export const createMosqueAttendanceForEmployees = async (
  date: string,
  employees: any[]
) => {
  try {
    const attendanceEntries = employees.map((employee: any) => ({
      employeeId: employee.$id,
      date,
      fathisSignInTime: null,
      mendhuruSignInTime: null,
      asuruSignInTime: null,
      maqribSignInTime: null,
      ishaSignInTime: null,
      leaveType: null,
    }));
    console.log(employees);

    await Promise.all(
      attendanceEntries.map(async (entry) => {
        await databases.createDocument(
          appwriteConfig.databaseId,
          appwriteConfig.mosqueAttendanceCollectionId,
          ID.unique(),
          entry
        );
      })
    );

    return attendanceEntries;
  } catch (error) {
    console.error("Error creating mosque attendance:", error);
    throw error;
  }
};

// Update attendance record for mosque
export const updateMosqueAttendanceRecord = async (
  attendanceId: string,
  updates: Partial<MosqueAttendanceRecord>
) => {
  try {
    const response = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.mosqueAttendanceCollectionId,
      attendanceId,
      updates
    );
    return response;
  } catch (error) {
    console.error("Error updating mosque attendance record:", error);
    throw error;
  }
};

// SAVE PRAYER TIMES
export const savePrayerTimes = async (prayerTimes: {
  date: string;
  fathisTime: string;
  mendhuruTime: string;
  asuruTime: string;
  maqribTime: string;
  ishaTime: string;
}) => {
  try {
    const response = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.prayerTimesCollectionId,
      ID.unique(),
      prayerTimes
    );
    return response;
  } catch (error) {
    console.error("Error saving prayer times:", error);
    throw error;
  }
};

export const updatePrayerTimes = async (
  recordId: string,
  updatedTimes: {
    fathisTime?: string;
    mendhuruTime?: string;
    asuruTime?: string;
    maqribTime?: string;
    ishaTime?: string;
  }
) => {
  try {
    const response = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.prayerTimesCollectionId,
      recordId,
      updatedTimes
    );
    return response;
  } catch (error) {
    console.error("Error updating prayer times:", error);
    throw error;
  }
};

export const fetchPrayerTimesByDate = async (date: string) => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.prayerTimesCollectionId,
      [Query.equal("date", date)]
    );
    return response.documents[0] || null;
  } catch (error) {
    console.error("Error fetching prayer times:", error);
    throw error;
  }
};
