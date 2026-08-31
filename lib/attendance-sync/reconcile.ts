import { withTimestamps } from "@/lib/firebase/adapters";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import {
  fetchAllEmployees,
  fetchMosqueAttendanceForDate,
} from "@/lib/firebase/hr";
import type { MosqueAttendanceDoc } from "@/lib/firebase/types";
import {
  graceMinutesForDesignation,
  listSyncEligibleEmployees,
} from "@/lib/attendance-sync/employee-sync";
import { findDuplicateRowsForDate } from "@/lib/attendance-sync/ensure-sheets";
import {
  calculateMinutesLate,
  classifyPunch,
  groupCandidatesByPrayer,
  selectEarliestPunchForPrayer,
} from "@/lib/attendance-sync/prayer-classifier";
import { clearLegacyPrefillFields } from "@/lib/attendance-sync/placeholder-cleanup";
import { listEligiblePunchesForEmployeeDate } from "@/lib/attendance-sync/punch-store";
import {
  resolvePreviousDayIshaTime,
  resolvePrayerTimesForDate,
  toMosquePrayerTimes,
} from "@/lib/attendance-sync/prayer-times";
import { isAttendanceSyncAutoWriteEnabled } from "@/lib/attendance-sync/runtime";
import { assertIsoDate, punchUtcToAttendanceIso, utcToMaldivesParts } from "@/lib/attendance-sync/time";
import type {
  MosqueAttendanceAutomation,
  MosquePrayer,
  ReconcileEmployeeResult,
  ReconcilePrayerPreview,
  ReconcileResult,
} from "@/lib/attendance-sync/types";
import { MOSQUE_PRAYERS } from "@/lib/attendance-sync/types";

const PRAYER_TO_TIME_KEY = {
  fathisSignInTime: "fathisTime",
  mendhuruSignInTime: "mendhuruTime",
  asuruSignInTime: "asuruTime",
  maqribSignInTime: "maqribTime",
  ishaSignInTime: "ishaTime",
} as const;

function readAutomation(row: MosqueAttendanceDoc): MosqueAttendanceAutomation {
  const stored = row.automation as MosqueAttendanceAutomation | undefined;
  return (
    stored ?? {
      version: 1,
      lastReconciledAt: null,
      manualOverridePrayers: [],
      prayerPunchRefs: {},
    }
  );
}

function hasApprovedLeave(row: MosqueAttendanceDoc): boolean {
  return Boolean(row.leaveType?.trim());
}

export async function reconcileMosqueAttendanceDate(
  date: string,
  employeeIds?: string[],
  options: { preview?: boolean } = {},
): Promise<ReconcileResult> {
  assertIsoDate(date);
  const preview = options.preview ?? !isAttendanceSyncAutoWriteEnabled();

  const [employees, rows, prayerTimes, previousIsha] = await Promise.all([
    fetchAllEmployees(),
    fetchMosqueAttendanceForDate(date),
    resolvePrayerTimesForDate(date),
    resolvePreviousDayIshaTime(date),
  ]);

  const eligible = listSyncEligibleEmployees(employees, date);
  const eligibleIds = new Set(eligible.map((entry) => entry.employee.$id));
  const targetIds =
    employeeIds && employeeIds.length > 0
      ? employeeIds.filter((id) => eligibleIds.has(id))
      : Array.from(eligibleIds);

  const rowsByEmployee = new Map<string, MosqueAttendanceDoc>();
  for (const row of rows) {
    if (!targetIds.includes(row.employeeId)) continue;
    rowsByEmployee.set(row.employeeId, row);
  }

  const duplicateConflicts = findDuplicateRowsForDate(rows);
  const conflictEmployees = new Set(duplicateConflicts.map((c) => c.employeeId));

  const results: ReconcileEmployeeResult[] = [];
  let updatedCount = 0;

  for (const { employee } of eligible) {
    if (!targetIds.includes(employee.$id)) continue;

    const row = rowsByEmployee.get(employee.$id) ?? null;
    if (conflictEmployees.has(employee.$id)) {
      results.push({
        employeeId: employee.$id,
        employeeName: employee.name,
        rowId: row?.$id ?? null,
        conflict: true,
        prayers: [],
        updated: false,
      });
      continue;
    }

    if (!row) {
      results.push({
        employeeId: employee.$id,
        employeeName: employee.name,
        rowId: null,
        prayers: MOSQUE_PRAYERS.map((prayer) => ({
          prayer,
          signInTime: null,
          minutesLate: 0,
          punchLogId: null,
          source: null,
          skippedReason: "no_punch",
        })),
        updated: false,
      });
      continue;
    }

    const automation = readAutomation(row);
    const leaveActive = hasApprovedLeave(row);
    const designation = employee.designation ?? "";
    const punches = await listEligiblePunchesForEmployeeDate(employee.$id, date, {
      zkUserId: employee.deviceUserId ?? employee.attendanceSync?.zkteco?.userId,
      etimeCode: employee.attendanceSync?.etime?.employeeCode,
    });

    const classified = prayerTimes
      ? punches.map((punch) => {
          const { localMinutes } = utcToMaldivesParts(punch.timestampUtc);
          const prayer = classifyPunch(
            punch.timestampUtc,
            localMinutes,
            prayerTimes,
            previousIsha,
          )?.prayer ?? null;
          return {
            punchLogId: punch.$id,
            source: punch.source,
            timestampUtc: punch.timestampUtc,
            localMinutes,
            prayer,
          };
        })
      : [];

    const grouped = groupCandidatesByPrayer(classified);
    const prayerResults: ReconcilePrayerPreview[] = [];
    const updates: Partial<MosqueAttendanceDoc> = {};
    const nextAutomation: MosqueAttendanceAutomation = {
      ...automation,
      lastReconciledAt: new Date().toISOString(),
      prayerPunchRefs: { ...automation.prayerPunchRefs },
    };

    for (const prayer of MOSQUE_PRAYERS) {
      const lateKey = prayer.replace("SignInTime", "MinutesLate") as keyof MosqueAttendanceDoc;
      const currentSignIn = row[prayer] as string | null;
      const overrideSet = new Set(automation.manualOverridePrayers);

      if (leaveActive) {
        prayerResults.push({
          prayer,
          signInTime: currentSignIn,
          minutesLate: (row[lateKey] as number | null) ?? 0,
          punchLogId: automation.prayerPunchRefs[prayer]?.punchLogId ?? null,
          source: automation.prayerPunchRefs[prayer]?.source ?? null,
          skippedReason: "leave",
        });
        continue;
      }

      if (overrideSet.has(prayer)) {
        prayerResults.push({
          prayer,
          signInTime: currentSignIn,
          minutesLate: (row[lateKey] as number | null) ?? 0,
          punchLogId: automation.prayerPunchRefs[prayer]?.punchLogId ?? null,
          source: automation.prayerPunchRefs[prayer]?.source ?? null,
          skippedReason: "manual_override",
        });
        continue;
      }

      const selected = selectEarliestPunchForPrayer(grouped.get(prayer) ?? []);
      if (!selected || !prayerTimes) {
        const shouldClear =
          currentSignIn &&
          (!prayerTimes ||
            Object.keys(
              clearLegacyPrefillFields(
                row,
                toMosquePrayerTimes(prayerTimes ?? {
                  fathisTime: "00:00",
                  mendhuruTime: "00:00",
                  asuruTime: "00:00",
                  maqribTime: "00:00",
                  ishaTime: "00:00",
                }),
                designation,
              ),
            ).includes(prayer));

        prayerResults.push({
          prayer,
          signInTime: shouldClear ? null : currentSignIn,
          minutesLate: shouldClear ? 0 : ((row[lateKey] as number | null) ?? 0),
          punchLogId: null,
          source: null,
          skippedReason: shouldClear ? undefined : "no_punch",
        });

        if (shouldClear) {
          updates[prayer] = null;
          updates[lateKey] = 0 as never;
          delete nextAutomation.prayerPunchRefs[prayer];
        }
        continue;
      }

      const signInTime = punchUtcToAttendanceIso(selected.timestampUtc, date);
      const prayerTimeKey = PRAYER_TO_TIME_KEY[prayer];
      const minutesLate = calculateMinutesLate(
        prayerTimes[prayerTimeKey],
        selected.localMinutes,
        designation,
      );

      const unchanged =
        currentSignIn === signInTime &&
        ((row[lateKey] as number | null) ?? 0) === minutesLate &&
        automation.prayerPunchRefs[prayer]?.punchLogId === selected.punchLogId;

      prayerResults.push({
        prayer,
        signInTime,
        minutesLate,
        punchLogId: selected.punchLogId,
        source: selected.source,
        skippedReason: unchanged ? "unchanged" : undefined,
      });

      if (!unchanged) {
        updates[prayer] = signInTime;
        updates[lateKey] = minutesLate as never;
        nextAutomation.prayerPunchRefs[prayer] = {
          punchLogId: selected.punchLogId,
          source: selected.source,
          timestampUtc: selected.timestampUtc,
        };
      }
    }

    const hasFieldUpdates = Object.keys(updates).length > 0;
    const updated = hasFieldUpdates;

    if (updated && !preview) {
      const db = getFirestoreDb();
      await db.runTransaction(async (tx) => {
        const ref = db.collection(COLLECTIONS.mosqueAttendance).doc(row.$id);
        const fresh = await tx.get(ref);
        if (!fresh.exists) return;

        const freshRow = { $id: fresh.id, ...fresh.data() } as MosqueAttendanceDoc;
        const freshAutomation = readAutomation(freshRow);
        if (hasApprovedLeave(freshRow)) return;

        const blocked = new Set(freshAutomation.manualOverridePrayers);
        const safeUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          const prayer = MOSQUE_PRAYERS.find((p) => p === key || p.replace("SignInTime", "MinutesLate") === key);
          if (prayer && blocked.has(prayer)) continue;
          safeUpdates[key] = value;
        }

        tx.set(
          ref,
          withTimestamps({
            ...safeUpdates,
            automation: nextAutomation,
          }),
          { merge: true },
        );
      });
      updatedCount += 1;
    } else if (updated) {
      updatedCount += 1;
    }

    results.push({
      employeeId: employee.$id,
      employeeName: employee.name,
      rowId: row.$id,
      prayers: prayerResults,
      updated,
    });
  }

  return {
    date,
    preview,
    employees: results,
    updatedCount,
    conflictCount: duplicateConflicts.length,
  };
}

export async function resumeAutomaticPrayerSync(
  attendanceId: string,
  prayer: MosquePrayer,
): Promise<ReconcileResult | null> {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.mosqueAttendance).doc(attendanceId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const row = { $id: snap.id, ...snap.data() } as MosqueAttendanceDoc;
  const automation = readAutomation(row);
  const nextOverrides = automation.manualOverridePrayers.filter((p) => p !== prayer);

  await ref.set(
    withTimestamps({
      automation: {
        ...automation,
        manualOverridePrayers: nextOverrides,
      },
    }),
    { merge: true },
  );

  return reconcileMosqueAttendanceDate(row.date, [row.employeeId], {
    preview: false,
  });
}

export async function markManualPrayerOverrides(
  attendanceId: string,
  prayers: MosquePrayer[],
): Promise<void> {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.mosqueAttendance).doc(attendanceId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const row = { $id: snap.id, ...snap.data() } as MosqueAttendanceDoc;
  const automation = readAutomation(row);
  const merged = Array.from(new Set([...automation.manualOverridePrayers, ...prayers]));

  await ref.set(
    withTimestamps({
      automation: {
        ...automation,
        manualOverridePrayers: merged,
      },
    }),
    { merge: true },
  );
}
