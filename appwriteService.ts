/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/appwriteService.ts
// Install: npm install node-appwrite
import { Client, Databases, Query, ID } from "node-appwrite";

interface AttendanceRecord {
  userId: string;
  timestamp: Date;
  deviceId: string;
  verifyMode: number;
  inOutMode: number;
}

export class AppwriteService {
  private client: Client;
  private databases: Databases;
  private databaseId: string;
  private attendanceCollectionId: string;

  constructor() {
    this.client = new Client();
    this.databases = new Databases(this.client);

    // Configure from environment variables
    this.databaseId = process.env.APPWRITE_DATABASE_ID!;
    this.attendanceCollectionId =
      process.env.APPWRITE_ATTENDANCE_COLLECTION_ID!;

    this.client
      .setEndpoint(
        process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1"
      )
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);
  }

  /**
   * Save attendance record to Appwrite
   */
  async saveAttendance(record: AttendanceRecord) {
    try {
      // Check if record already exists (prevent duplicates)
      const existing = await this.databases.listDocuments(
        this.databaseId,
        this.attendanceCollectionId,
        [
          Query.equal("userId", record.userId),
          Query.equal("timestamp", record.timestamp.toISOString()),
        ]
      );

      if (existing.documents.length > 0) {
        console.log("⚠️ Record already exists, skipping");
        return existing.documents[0];
      }

      // Create new attendance record
      const document = await this.databases.createDocument(
        this.databaseId,
        this.attendanceCollectionId,
        ID.unique(),
        {
          userId: record.userId,
          timestamp: record.timestamp.toISOString(),
          deviceId: record.deviceId,
          verifyMode: record.verifyMode,
          inOutMode: record.inOutMode,
          syncedAt: new Date().toISOString(),
        }
      );

      console.log("✅ Attendance saved:", document.$id);
      return document;
    } catch (error) {
      console.error("❌ Failed to save attendance:", error);
      throw error;
    }
  }

  /**
   * Bulk save attendance records
   */
  async bulkSaveAttendance(records: AttendanceRecord[]) {
    const results = {
      success: 0,
      failed: 0,
      duplicate: 0,
    };

    for (const record of records) {
      try {
        await this.saveAttendance(record);
        results.success++;
      } catch (error: any) {
        if (error.message?.includes("already exists")) {
          results.duplicate++;
        } else {
          results.failed++;
        }
      }
    }

    console.log("📊 Bulk save results:", results);
    return results;
  }

  /**
   * Get attendance records for a user
   */
  async getUserAttendance(userId: string, startDate?: Date, endDate?: Date) {
    try {
      const queries = [Query.equal("userId", userId)];

      if (startDate) {
        queries.push(
          Query.greaterThanEqual("timestamp", startDate.toISOString())
        );
      }
      if (endDate) {
        queries.push(Query.lessThanEqual("timestamp", endDate.toISOString()));
      }

      queries.push(Query.orderDesc("timestamp"));

      const response = await this.databases.listDocuments(
        this.databaseId,
        this.attendanceCollectionId,
        queries
      );

      return response.documents;
    } catch (error) {
      console.error("❌ Failed to get user attendance:", error);
      throw error;
    }
  }

  /**
   * Get all attendance for a specific date
   */
  async getAttendanceByDate(date: Date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const response = await this.databases.listDocuments(
        this.databaseId,
        this.attendanceCollectionId,
        [
          Query.greaterThanEqual("timestamp", startOfDay.toISOString()),
          Query.lessThanEqual("timestamp", endOfDay.toISOString()),
          Query.orderDesc("timestamp"),
        ]
      );

      return response.documents;
    } catch (error) {
      console.error("❌ Failed to get attendance by date:", error);
      throw error;
    }
  }

  /**
   * Get the last synced timestamp
   */
  async getLastSyncTime(): Promise<Date | null> {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.attendanceCollectionId,
        [Query.orderDesc("syncedAt"), Query.limit(1)]
      );

      if (response.documents.length > 0) {
        return new Date(response.documents[0].syncedAt);
      }
      return null;
    } catch (error) {
      console.error("❌ Failed to get last sync time:", error);
      return null;
    }
  }
}

// Export singleton instance
export const appwriteService = new AppwriteService();
