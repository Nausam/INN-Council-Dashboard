/* eslint-disable @typescript-eslint/no-explicit-any */
// zktecoService.ts
// Install: npm install zklib-js
import ZKLib from "zklib-js";

interface AttendanceRecord {
  userId: string;
  timestamp: Date;
  deviceId: string;
  verifyMode: number; // 1: fingerprint, 15: face, etc.
  inOutMode: number; // 0: check-in, 1: check-out, etc.
}

export class ZKTecoService {
  private deviceIp: string;
  private devicePort: number;
  private zkInstance: any;

  constructor(ip: string = "10.14.166.20", port: number = 4370) {
    this.deviceIp = ip;
    this.devicePort = port;
    this.zkInstance = null;
  }

  /**
   * Connect to the fingerprint device
   */
  async connect(): Promise<boolean> {
    try {
      this.zkInstance = new ZKLib({
        ip: this.deviceIp,
        port: this.devicePort,
        timeout: 5000,
        inport: 5200,
      });

      await this.zkInstance.createSocket();
      console.log("✅ Connected to device");
      return true;
    } catch (error) {
      console.error("❌ Connection failed:", error);
      throw new Error(`Failed to connect to device: ${error}`);
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (this.zkInstance) {
      await this.zkInstance.disconnect();
      console.log("🔌 Disconnected from device");
    }
  }

  /**
   * Get all attendance records from device
   */
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    try {
      if (!this.zkInstance) {
        await this.connect();
      }

      const attendances = await this.zkInstance.getAttendances();

      const records: AttendanceRecord[] = attendances.data.map(
        (record: any) => ({
          userId: record.deviceUserId || record.uid,
          timestamp: record.recordTime || record.attTime,
          deviceId: "iClock3000",
          verifyMode: record.verifyMode || 1,
          inOutMode: record.inOutMode || 0,
        })
      );

      console.log(`📊 Retrieved ${records.length} attendance records`);
      return records;
    } catch (error) {
      console.error("❌ Failed to get attendance records:", error);
      throw error;
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo() {
    try {
      if (!this.zkInstance) {
        await this.connect();
      }

      const info = await this.zkInstance.getInfo();
      return {
        userCount: info.userCounts,
        attendanceCount: info.logCounts,
        faceCount: info.faceCounts,
        capacity: info.logCapacity,
      };
    } catch (error) {
      console.error("❌ Failed to get device info:", error);
      throw error;
    }
  }

  /**
   * Clear all attendance records from device (use carefully!)
   */
  async clearAttendanceRecords(): Promise<boolean> {
    try {
      if (!this.zkInstance) {
        await this.connect();
      }

      await this.zkInstance.clearAttendanceLog();
      console.log("🗑️ Cleared attendance records from device");
      return true;
    } catch (error) {
      console.error("❌ Failed to clear records:", error);
      throw error;
    }
  }

  /**
   * Get users registered on the device
   */
  async getUsers() {
    try {
      if (!this.zkInstance) {
        await this.connect();
      }

      const users = await this.zkInstance.getUsers();
      return users.data.map((user: any) => ({
        uid: user.uid,
        userId: user.userId,
        name: user.name,
        role: user.role,
        cardNumber: user.cardno,
      }));
    } catch (error) {
      console.error("❌ Failed to get users:", error);
      throw error;
    }
  }

  /**
   * Real-time attendance listener (for push mode)
   */
  async startRealTimeMode(callback: (record: AttendanceRecord) => void) {
    try {
      if (!this.zkInstance) {
        await this.connect();
      }

      // Enable real-time mode
      await this.zkInstance.getRealTimeLogs((data: any) => {
        const record: AttendanceRecord = {
          userId: data.deviceUserId || data.uid,
          timestamp: new Date(),
          deviceId: "iClock3000",
          verifyMode: data.verifyMode || 1,
          inOutMode: data.inOutMode || 0,
        };

        console.log("🔔 Real-time attendance:", record);
        callback(record);
      });

      console.log("👂 Real-time mode started");
    } catch (error) {
      console.error("❌ Failed to start real-time mode:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const zkService = new ZKTecoService();
