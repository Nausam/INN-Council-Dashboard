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
    const attendanceEntries = employees.map((employee: any) => ({
      employeeId: employee.$id,
      date,
      signInTime: "",
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

    console.log("Attendance updated successfully");
  } catch (error) {
    console.error("Error updating attendance:", error);
    throw error;
  }
};

export const fetchAttendanceForMonth = async (month: string) => {
  const startOfMonth = new Date(`${month}-01T00:00:00Z`).toISOString();
  const endOfMonth = new Date(
    new Date(`${month}-01T00:00:00Z`).setMonth(new Date().getMonth() + 1)
  ).toISOString();

  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.attendanceCollectionId,
      [
        Query.greaterThanEqual("date", startOfMonth),
        Query.lessThanEqual("date", endOfMonth),
      ]
    );
    return response.documents;
  } catch (error) {
    console.error("Error fetching attendance for month:", error);
    throw error;
  }
};

// Function to create employee record
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

// Function to update employee's leave balance in the database
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
