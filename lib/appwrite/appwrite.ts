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

export const appwriteConfig = {
  endpoint: "https://cloud.appwrite.io/v1",
  projectId: "66f134a7001102e81a6d",
  databaseId: "66f135a0002dfd91853a",
  employeesCollectionId: "6708bd860020db2f8598",
  attendanceCollectionId: "6701373d00373ea0dd09",
  mosqueAttendanceCollectionId: "6748841b0005589c9c31",
  prayerTimesCollectionId: "6749573400305f49417b",
  leaveRequestsCollectionId: "674ee238003517f3004d",
  wasteManagementFormsId: "6784e0610000e598d1e6",
};

const {
  endpoint,
  projectId,
  databaseId,
  employeesCollectionId,
  attendanceCollectionId,
  mosqueAttendanceCollectionId,
  leaveRequestsCollectionId,
  wasteManagementFormsId,
} = appwriteConfig;

const client = new Client();

client.setEndpoint(endpoint).setProject(projectId);

const account = new Account(client);
const avatars = new Avatars(client);
const databases = new Databases(client);

type LeaveRequest = Models.Document & {
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string;
  endDate: string;
  approvalStatus: string;
};

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

    // Filter out employees with the designation "Mosque Assistant"
    const filteredEmployees = employees.filter(
      (employee) => employee.designation !== "Mosque Assistant"
    );

    const attendanceEntries = filteredEmployees.map((employee: any) => ({
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
  } catch (error) {
    console.error(`Error deleting attendance records for ${date}:`, error);
    throw new Error(`Failed to delete attendance records for ${date}`);
  }
};

// MOSQUE ASSISTANTS ATTENDANCE

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

// Create attendance for mosque assistants
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

// Update attendance record for mosque assistants
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

// Save prayer times
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

// Update prayer times
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

// Get prayer times by date
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

// Get prayer times by month
export const fetchPrayerTimesForMonth = async (month: string) => {
  try {
    const startOfMonth = new Date(`${month}-01T00:00:00Z`).toISOString();
    const endOfMonth = new Date(
      new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)
    ).toISOString();

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.prayerTimesCollectionId,
      [
        Query.greaterThanEqual("date", startOfMonth),
        Query.lessThanEqual("date", endOfMonth),
      ]
    );

    return response.documents; // Return all prayer times for the month
  } catch (error) {
    console.error("Error fetching prayer times for the month:", error);
    throw error;
  }
};

// Get mosque attendance for the month
export const fetchMosqueAttendanceForMonth = async (month: string) => {
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
        appwriteConfig.mosqueAttendanceCollectionId,
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

// Get daily mosque attendance
export const fetchMosqueDailyAttendanceForMonth = async (
  month: string,
  employeeId: string
) => {
  try {
    const startOfMonth = `${month}-01T00:00:00Z`;
    const endOfMonth = new Date(
      new Date(`${month}-01T00:00:00Z`).setMonth(
        new Date(`${month}-01T00:00:00Z`).getMonth() + 1
      )
    ).toISOString();

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.mosqueAttendanceCollectionId,
      [
        Query.greaterThanEqual("date", startOfMonth),
        Query.lessThanEqual("date", endOfMonth),
        Query.equal("employeeId", employeeId), // Filter by employee ID
      ]
    );

    return response.documents;
  } catch (error) {
    console.error("Error fetching mosque attendance:", error);
    throw error;
  }
};

// Get mosque assistants
export const fetchMosqueAssistants = async () => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.employeesCollectionId,
      [Query.equal("designation", "Mosque Assistant")] // Filter employees by designation
    );
    return response.documents; // Return filtered employees
  } catch (error) {
    console.error("Error fetching mosque assistants:", error);
    throw error;
  }
};

// Delete mosque attendances by date
export const deleteMosqueAttendancesByDate = async (
  date: string
): Promise<void> => {
  try {
    // Query the documents by date field
    const response = await databases.listDocuments(
      databaseId,
      mosqueAttendanceCollectionId,
      [Query.equal("date", date)]
    );

    const attendanceRecords = response.documents;

    if (attendanceRecords.length === 0) {
      console.log(`No attendance records found for date: ${date}`);
      return; // No records to delete
    }

    // Delete each attendance record
    const deletePromises = attendanceRecords.map((record) =>
      databases.deleteDocument(
        databaseId,
        mosqueAttendanceCollectionId,
        record.$id
      )
    );

    // Wait for all delete operations to complete
    await Promise.all(deletePromises);
  } catch (error) {
    console.error(`Error deleting attendance records for ${date}:`, error);
    throw new Error(`Failed to delete attendance records for ${date}`);
  }
};

// AUTHENTICATION

// Create email and password session
export const createEmailSession = async (email: string, password: string) => {
  try {
    const response = await account.createEmailPasswordSession(email, password);

    return response;
  } catch (error) {
    console.error("Error creating email session:", error);
    throw error;
  }
};

// LEAVE REQUESTS

// Create leave requests
export const createLeaveRequest = async (leaveRequestData: {
  fullName: string;
  leaveType: string;
  reason: string;
  totalDays: number;
  startDate: string;
  endDate: string;
}) => {
  try {
    const currentDateTime = new Date().toISOString();

    const response = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.leaveRequestsCollectionId,
      ID.unique(),
      {
        ...leaveRequestData,
        createdAt: currentDateTime,
      }
    );

    console.log("Leave request created:", response);
    return response;
  } catch (error) {
    console.error("Error creating leave request:", error);
    throw new Error("Failed to create leave request.");
  }
};

// Get leave requests for admin
export const fetchLeaveRequests = async (
  limit = 10,
  offset = 0
): Promise<{ requests: any[]; totalCount: number }> => {
  try {
    // Fetch leave requests with pagination
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.leaveRequestsCollectionId,
      [Query.orderDesc("createdAt"), Query.limit(limit), Query.offset(offset)]
    );

    return {
      requests: response.documents, // The leave requests
      totalCount: response.total, // Total number of documents in the collection
    };
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    throw error;
  }
};

// Update leave requests
export const updateLeaveRequest = async (
  requestId: string,
  data: { approvalStatus: string; actionBy?: string }
) => {
  try {
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.leaveRequestsCollectionId,
      requestId,
      data
    );
  } catch (error) {
    console.error("Error updating leave request:", error);
    throw error;
  }
};

// Get leave requests for users
export const fetchUserLeaveRequests = async (
  status?: string,
  limit = 10,
  offset = 0
): Promise<{ requests: LeaveRequest[]; totalCount: number }> => {
  try {
    const filters = status ? [Query.equal("approvalStatus", status)] : [];

    const response = await databases.listDocuments<LeaveRequest>(
      appwriteConfig.databaseId,
      appwriteConfig.leaveRequestsCollectionId,
      [
        ...filters,
        Query.limit(limit),
        Query.offset(offset),
        Query.orderDesc("createdAt"),
      ]
    );
    return {
      requests: response.documents,
      totalCount: response.total,
    };
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    throw error;
  }
};
