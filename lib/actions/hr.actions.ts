"use server";

import * as hr from "@/lib/firebase/hr";
import { requireAdmin } from "@/lib/auth/require-admin";
import { hasEmployeeProfileAccess } from "@/lib/auth/employee-profile-session";
import { getSessionAuthProfile } from "@/lib/auth/session-profile";

async function requireStaffSession(): Promise<void> {
  if (!(await getSessionAuthProfile())) throw new Error("Unauthorized");
}

export async function createEmployeeRecord(
  ...args: Parameters<typeof hr.createEmployeeRecord>
) {
  await requireAdmin();
  return hr.createEmployeeRecord(...args);
}

export async function createOvertimeRequest(
  ...args: Parameters<typeof hr.createOvertimeRequest>
) {
  await requireStaffSession();
  return hr.createOvertimeRequest(...args);
}

export async function deductLeave(...args: Parameters<typeof hr.deductLeave>) {
  await requireStaffSession();
  return hr.deductLeave(...args);
}

export async function deleteAttendancesByDate(
  ...args: Parameters<typeof hr.deleteAttendancesByDate>
) {
  await requireAdmin();
  return hr.deleteAttendancesByDate(...args);
}

export async function deleteEmployeeRecord(
  ...args: Parameters<typeof hr.deleteEmployeeRecord>
) {
  await requireAdmin();
  return hr.deleteEmployeeRecord(...args);
}

export async function deleteMosqueAttendancesByDate(
  ...args: Parameters<typeof hr.deleteMosqueAttendancesByDate>
) {
  await requireAdmin();
  return hr.deleteMosqueAttendancesByDate(...args);
}

export async function fetchAllEmployees() {
  if (!(await getSessionAuthProfile())) throw new Error("Unauthorized");
  return hr.fetchAllEmployees();
}

export async function fetchAttendanceAfterDate(
  ...args: Parameters<typeof hr.fetchAttendanceAfterDate>
) {
  await requireStaffSession();
  return hr.fetchAttendanceAfterDate(...args);
}

export async function fetchAttendanceForEmployeeMonth(
  ...args: Parameters<typeof hr.fetchAttendanceForEmployeeMonth>
) {
  if (!(await hasEmployeeProfileAccess(args[1]))) throw new Error("Unauthorized");
  return hr.fetchAttendanceForEmployeeMonth(...args);
}

export async function fetchAttendanceForMonth(
  ...args: Parameters<typeof hr.fetchAttendanceForMonth>
) {
  await requireStaffSession();
  return hr.fetchAttendanceForMonth(...args);
}

export async function fetchEmployeeById(
  ...args: Parameters<typeof hr.fetchEmployeeById>
) {
  if (!(await hasEmployeeProfileAccess(args[0]))) throw new Error("Unauthorized");
  return hr.fetchEmployeeById(...args);
}

export async function fetchEmployeeLeaveCalendar(
  ...args: Parameters<typeof hr.fetchEmployeeLeaveCalendar>
) {
  if (!(await hasEmployeeProfileAccess(args[0]))) throw new Error("Unauthorized");
  return hr.fetchEmployeeLeaveCalendar(...args);
}

export async function fetchLeaveRequests(
  ...args: Parameters<typeof hr.fetchLeaveRequests>
) {
  await requireAdmin();
  return hr.fetchLeaveRequests(...args);
}

export async function fetchMosqueAssistants() {
  await requireStaffSession();
  return hr.fetchMosqueAssistants();
}

export async function fetchMosqueAttendanceForMonth(
  ...args: Parameters<typeof hr.fetchMosqueAttendanceForMonth>
) {
  await requireStaffSession();
  return hr.fetchMosqueAttendanceForMonth(...args);
}

export async function fetchMosqueAttendanceForPeriod(
  ...args: Parameters<typeof hr.fetchMosqueAttendanceForPeriod>
) {
  await requireStaffSession();
  return hr.fetchMosqueAttendanceForPeriod(...args);
}

export async function fetchMosqueDailyAttendanceForMonth(
  ...args: Parameters<typeof hr.fetchMosqueDailyAttendanceForMonth>
) {
  if (!(await hasEmployeeProfileAccess(args[1]))) throw new Error("Unauthorized");
  return hr.fetchMosqueDailyAttendanceForMonth(...args);
}

export async function fetchOvertimeRequests(
  ...args: Parameters<typeof hr.fetchOvertimeRequests>
) {
  await requireAdmin();
  return hr.fetchOvertimeRequests(...args);
}

export async function fetchPrayerTimesByDate(
  ...args: Parameters<typeof hr.fetchPrayerTimesByDate>
) {
  await requireStaffSession();
  return hr.fetchPrayerTimesByDate(...args);
}

export async function fetchPrayerTimesForMonth(
  ...args: Parameters<typeof hr.fetchPrayerTimesForMonth>
) {
  await requireStaffSession();
  return hr.fetchPrayerTimesForMonth(...args);
}

export async function fetchSlimEmployees() {
  await requireStaffSession();
  return hr.fetchSlimEmployees();
}

export async function savePrayerTimes(
  ...args: Parameters<typeof hr.savePrayerTimes>
) {
  await requireAdmin();
  return hr.savePrayerTimes(...args);
}

export async function updateEmployeeRecord(
  ...args: Parameters<typeof hr.updateEmployeeRecord>
) {
  await requireAdmin();
  return hr.updateEmployeeRecord(...args);
}

export async function updateLeaveRequest(
  ...args: Parameters<typeof hr.updateLeaveRequest>
) {
  await requireAdmin();
  return hr.updateLeaveRequest(...args);
}

export async function updateMosqueAttendanceRecord(
  ...args: Parameters<typeof hr.updateMosqueAttendanceRecord>
) {
  await requireStaffSession();
  return hr.updateMosqueAttendanceRecord(...args);
}

export async function updateOvertimeRequest(
  ...args: Parameters<typeof hr.updateOvertimeRequest>
) {
  await requireAdmin();
  return hr.updateOvertimeRequest(...args);
}
