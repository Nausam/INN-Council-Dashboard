"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  invalidateCorrespondence,
  invalidateCouncilAttendance,
  invalidateEmployees,
  invalidateLandRent,
  invalidateLeaveRequests,
  invalidateMosqueAttendance,
  invalidatePrayerTimes,
  invalidateSalarySlips,
} from "@/lib/query/invalidate";

export function useQueryInvalidation() {
  const queryClient = useQueryClient();

  return {
    invalidateEmployees: useCallback(
      (id?: string) => invalidateEmployees(queryClient, id),
      [queryClient],
    ),
    invalidateCouncilAttendance: useCallback(
      (date: string, month?: string) =>
        invalidateCouncilAttendance(queryClient, date, month),
      [queryClient],
    ),
    invalidateMosqueAttendance: useCallback(
      (date: string, month?: string) =>
        invalidateMosqueAttendance(queryClient, date, month),
      [queryClient],
    ),
    invalidateLeaveRequests: useCallback(
      () => invalidateLeaveRequests(queryClient),
      [queryClient],
    ),
    invalidateCorrespondence: useCallback(
      (id?: string) => invalidateCorrespondence(queryClient, id),
      [queryClient],
    ),
    invalidateLandRent: useCallback(
      (leaseId?: string) => invalidateLandRent(queryClient, leaseId),
      [queryClient],
    ),
    invalidateSalarySlips: useCallback(
      (period?: string, recordCard?: string) =>
        invalidateSalarySlips(queryClient, period, recordCard),
      [queryClient],
    ),
    invalidatePrayerTimes: useCallback(
      (date?: string, month?: string) =>
        invalidatePrayerTimes(queryClient, date, month),
      [queryClient],
    ),
    invalidateAll: useCallback(
      () => queryClient.invalidateQueries(),
      [queryClient],
    ),
  };
}
