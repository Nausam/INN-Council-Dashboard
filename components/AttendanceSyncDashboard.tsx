// components/AttendanceSyncDashboard.tsx
"use client";

import { useState } from "react";

interface SyncResult {
  success: boolean;
  message: string;
  data?: {
    totalRecords: number;
    success: number;
    failed: number;
    duplicate: number;
  };
}

interface DeviceInfo {
  userCount: number;
  attendanceCount: number;
  faceCount: number;
  capacity: number;
}

export default function AttendanceSyncDashboard() {
  const [syncing, setSyncing] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/attendance/sync", {
        method: "POST",
      });

      const result = await response.json();
      setSyncResult(result);
    } catch (error) {
      setSyncResult({
        success: false,
        message: "Failed to sync attendance",
      });
    } finally {
      setSyncing(false);
    }
  };

  const fetchDeviceInfo = async () => {
    setLoadingInfo(true);

    try {
      const response = await fetch("/api/attendance/device-info");
      const result = await response.json();

      if (result.success) {
        setDeviceInfo(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch device info:", error);
    } finally {
      setLoadingInfo(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6">Attendance Sync Dashboard</h2>

        {/* Device Info Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Device Information</h3>
            <button
              onClick={fetchDeviceInfo}
              disabled={loadingInfo}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingInfo ? "Loading..." : "Refresh Info"}
            </button>
          </div>

          {deviceInfo && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Users</p>
                <p className="text-2xl font-bold">{deviceInfo.userCount}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Attendance Records</p>
                <p className="text-2xl font-bold">
                  {deviceInfo.attendanceCount}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Face Count</p>
                <p className="text-2xl font-bold">{deviceInfo.faceCount}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Capacity</p>
                <p className="text-2xl font-bold">{deviceInfo.capacity}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sync Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Sync Attendance</h3>
          <p className="text-gray-600 mb-4">
            Click the button below to fetch all attendance records from the
            fingerprint device and sync them to your database.
          </p>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full md:w-auto px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {syncing ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Syncing...
              </span>
            ) : (
              "Sync Now"
            )}
          </button>

          {/* Sync Result */}
          {syncResult && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                syncResult.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {syncResult.success ? (
                    <svg
                      className="h-5 w-5 text-green-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h3
                    className={`text-sm font-medium ${
                      syncResult.success ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {syncResult.message}
                  </h3>
                  {syncResult.data && (
                    <div className="mt-2 text-sm text-gray-700">
                      <p>Total Records: {syncResult.data.totalRecords}</p>
                      <p>Successfully Saved: {syncResult.data.success}</p>
                      <p>Duplicates Skipped: {syncResult.data.duplicate}</p>
                      <p>Failed: {syncResult.data.failed}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2 text-blue-900">
          💡 Tip: Automated Syncing
        </h3>
        <p className="text-blue-800">
          To automatically sync attendance every few minutes, set up a cron job
          or use a service like Vercel Cron Jobs to call the{" "}
          <code className="bg-blue-100 px-2 py-1 rounded">
            /api/attendance/sync
          </code>{" "}
          endpoint periodically.
        </p>
      </div>
    </div>
  );
}
