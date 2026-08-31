"use server";

import * as hr from "@/lib/firebase/hr";

export async function createEmployeeRecord(
  ...args: Parameters<typeof hr.createEmployeeRecord>
) {
  return hr.createEmployeeRecord(...args);
}

export async function createLeaveRequest(
  ...args: Parameters<typeof hr.createLeaveRequest>
) {
  return hr.createLeaveRequest(...args);
}

export async function createOvertimeRequest(
  ...args: Parameters<typeof hr.createOvertimeRequest>
) {
  return hr.createOvertimeRequest(...args);
}

export async function deductLeave(...args: Parameters<typeof hr.deductLeave>) {
  return hr.deductLeave(...args);
}

export async function deleteAttendancesByDate(
  ...args: Parameters<typeof hr.deleteAttendancesByDate>
) {
  return hr.deleteAttendancesByDate(...args);
}

export async function deleteEmployeeRecord(
  ...args: Parameters<typeof hr.deleteEmployeeRecord>
) {
  return hr.deleteEmployeeRecord(...args);
}

export async function deleteMosqueAttendancesByDate(
  ...args: Parameters<typeof hr.deleteMosqueAttendancesByDate>
) {
  return hr.deleteMosqueAttendancesByDate(...args);
}

export async function fetchAllEmployees() {
  return hr.fetchAllEmployees();
}

export async function fetchAttendanceAfterDate(
  ...args: Parameters<typeof hr.fetchAttendanceAfterDate>
) {
  return hr.fetchAttendanceAfterDate(...args);
}

export async function fetchAttendanceForEmployeeMonth(
  ...args: Parameters<typeof hr.fetchAttendanceForEmployeeMonth>
) {
  return hr.fetchAttendanceForEmployeeMonth(...args);
}

export async function fetchAttendanceForMonth(
  ...args: Parameters<typeof hr.fetchAttendanceForMonth>
) {
  return hr.fetchAttendanceForMonth(...args);
}

export async function fetchEmployeeById(
  ...args: Parameters<typeof hr.fetchEmployeeById>
) {
  return hr.fetchEmployeeById(...args);
}

export async function fetchEmployeeLeaveCalendar(
  ...args: Parameters<typeof hr.fetchEmployeeLeaveCalendar>
) {
  return hr.fetchEmployeeLeaveCalendar(...args);
}

export async function fetchLeaveRequests(
  ...args: Parameters<typeof hr.fetchLeaveRequests>
) {
  return hr.fetchLeaveRequests(...args);
}

export async function fetchMosqueAssistants() {
  return hr.fetchMosqueAssistants();
}

export async function fetchMosqueAttendanceForMonth(
  ...args: Parameters<typeof hr.fetchMosqueAttendanceForMonth>
) {
  return hr.fetchMosqueAttendanceForMonth(...args);
}

export async function fetchMosqueAttendanceForPeriod(
  ...args: Parameters<typeof hr.fetchMosqueAttendanceForPeriod>
) {
  return hr.fetchMosqueAttendanceForPeriod(...args);
}

export async function fetchMosqueDailyAttendanceForMonth(
  ...args: Parameters<typeof hr.fetchMosqueDailyAttendanceForMonth>
) {
  return hr.fetchMosqueDailyAttendanceForMonth(...args);
}

export async function fetchOvertimeRequests(
  ...args: Parameters<typeof hr.fetchOvertimeRequests>
) {
  return hr.fetchOvertimeRequests(...args);
}

export async function fetchPrayerTimesByDate(
  ...args: Parameters<typeof hr.fetchPrayerTimesByDate>
) {
  return hr.fetchPrayerTimesByDate(...args);
}

export async function fetchPrayerTimesForMonth(
  ...args: Parameters<typeof hr.fetchPrayerTimesForMonth>
) {
  return hr.fetchPrayerTimesForMonth(...args);
}

export async function fetchSlimEmployees() {
  return hr.fetchSlimEmployees();
}

export async function fetchUserLeaveRequests(
  ...args: Parameters<typeof hr.fetchUserLeaveRequests>
) {
  return hr.fetchUserLeaveRequests(...args);
}

export async function savePrayerTimes(
  ...args: Parameters<typeof hr.savePrayerTimes>
) {
  return hr.savePrayerTimes(...args);
}

export async function updateEmployeeRecord(
  ...args: Parameters<typeof hr.updateEmployeeRecord>
) {
  return hr.updateEmployeeRecord(...args);
}

export async function updateLeaveRequest(
  ...args: Parameters<typeof hr.updateLeaveRequest>
) {
  return hr.updateLeaveRequest(...args);
}

export async function updateMosqueAttendanceRecord(
  ...args: Parameters<typeof hr.updateMosqueAttendanceRecord>
) {
  return hr.updateMosqueAttendanceRecord(...args);
}

export async function updateOvertimeRequest(
  ...args: Parameters<typeof hr.updateOvertimeRequest>
) {
  return hr.updateOvertimeRequest(...args);
}
