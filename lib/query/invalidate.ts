import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export function invalidateEmployees(queryClient: QueryClient, id?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
  if (id) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.employees.detail(id),
    });
  }
}

export function invalidateCouncilAttendance(
  queryClient: QueryClient,
  date: string,
  month?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.attendance.council(date),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.byDate(date),
  });
  if (month) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.attendance.councilMonth(month),
    });
  }
}

export function invalidateMosqueAttendance(
  queryClient: QueryClient,
  date: string,
  month?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.attendance.mosque(date),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.byDate(date),
  });
  if (month) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.attendance.mosqueMonth(month),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.attendance.mosqueDailyMonth(month),
    });
  }
}

export function invalidateLeaveRequests(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
}

export function invalidateOvertimeRequests(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["overtime-requests"] });
}

export function invalidateCorrespondence(queryClient: QueryClient, id?: string) {
  void queryClient.invalidateQueries({ queryKey: ["correspondence"] });
  if (id) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.correspondence.detail(id),
    });
  }
}

export function invalidateLandRent(queryClient: QueryClient, leaseId?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.landRent.overview });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.landRent.leaseOptions,
  });
  if (leaseId) {
    void queryClient.invalidateQueries({ queryKey: ["land-rent", "statements", leaseId] });
    void queryClient.invalidateQueries({ queryKey: ["land-rent", "preview", leaseId] });
  }
}

export function invalidateSalarySlips(
  queryClient: QueryClient,
  period?: string,
  recordCard?: string,
) {
  if (period) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.salarySlips.uploaded(period),
    });
  }
  if (recordCard) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.salarySlips.byRecord(recordCard),
    });
  }
}

export function invalidatePrayerTimes(
  queryClient: QueryClient,
  date?: string,
  month?: string,
) {
  if (date) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.prayerTimes.byDate(date),
    });
  }
  if (month) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.prayerTimes.month(month),
    });
  }
}
