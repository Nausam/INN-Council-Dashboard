# Dual-Machine Attendance Synchronization Plan

## 1. Target behavior

- Treat ZKTeco and eTime/TeamOffice as independent punch sources feeding one canonical attendance pipeline.
- At `00:05` Maldives time, automatically create a mosque attendance row for every eligible employee for that date.
- Create sheets with all five prayer attendance fields empty. Scheduled prayer times must never be inserted as attendance.
- After either source reports a punch, reconcile the affected employee, date, and prayer immediately.
- Use a valid punch even when it exists on only one machine.
- When both machines have valid punches, use the earliest punch.
- If neither machine has a valid punch, leave that prayer field empty so it displays as `Absent`.
- Continue using:
  - Imam grace period: 5 minutes before prayer.
  - Council Assistant grace period: 15 minutes before prayer.
  - Red timing display whenever calculated lateness is greater than zero.
  - Maximum 90-minute distance between a punch and its assigned prayer.
- Use `Asia/Maldives` as the authoritative timezone for sheet dates, prayer classification, and lateness.

## 2. Canonical data model and employee mapping

### Employee configuration

Extend each mosque employee with an explicit attendance-sync configuration:

```ts
type EmployeeAttendanceSyncConfig = {
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  zkteco?: {
    enabled: boolean;
    userId: string;
  };
  etime?: {
    enabled: boolean;
    employeeCode: string;
    departmentId: string;
  };
};
```

- Do not match production punches using employee names; names differ between systems.
- Keep the existing `deviceUserId` temporarily for compatibility, but migrate synchronization to the explicit source configuration.
- Validate that an enabled source identifier belongs to only one employee.
- Include an employee on a given date only when:
  - `attendanceSync.enabled` is true.
  - The date falls within `effectiveFrom`/`effectiveTo`.
  - Their section is `Mosque`.
  - Their designation is `Imam` or `Council Assistant`.
- Bootstrap the known mappings:

| Employee | ZKTeco ID | eTime code | eTime department |
|---|---:|---:|---:|
| Mohamed Shahidh | 18 | 4 | 1 |
| Ahmed Zahidh | 30 | 3 | 1 |
| Mohamed Mahir | 10 | 7 | 2 |
| Ibrahim Hashim | 15 | 8 | 2 |
| Ibrahim Waseem | 13 | 5 | 2 |
| Hawwa Luiza | 35 | Disabled | - |

### Canonical punch records

Normalize both sources into `punch_logs` using:

```ts
type AttendancePunchDoc = {
  source: "zkteco" | "etime";
  sourceRecordId: string;
  sourceDeviceId: string | null;
  sourceEmployeeId: string;
  employeeId: string | null;
  timestampUtc: string;
  localDate: string;
  localTime: string;
  timezone: "Asia/Maldives";
  eligible: boolean;
  ignoredReason: string | null;
  lastSeenAt: string;
  voidedAt: string | null;
  importedAt: string;
  dedupeKey: string;
};
```

- Use deterministic source-prefixed document IDs.
- Keep duplicate physical punches from separate machines as separate audit records.
- ZKTeco records are append-only.
- Treat a validated eTime date response as an authoritative snapshot:
  - Returned records are active.
  - Ignored punches remain stored but have `eligible: false`.
  - Previously imported records missing from a complete successful snapshot become voided.
  - Never void records after a login, network, parser, or partial-response failure.
- Add Firestore indexes for:
  - `employeeId + localDate + timestampUtc`
  - `source + localDate`
  - `source + sourceEmployeeId + localDate`

### Attendance automation metadata

Add non-breaking metadata to each `mosque_attendance` row:

```ts
type MosqueAttendanceAutomation = {
  version: 1;
  lastReconciledAt: string | null;
  manualOverridePrayers: MosquePrayer[];
  prayerPunchRefs: Partial<Record<
    MosquePrayer,
    {
      punchLogId: string;
      source: "zkteco" | "etime";
      timestampUtc: string;
    }
  >>;
};
```

- A manual edit marks only the edited prayer as overridden.
- Automatic synchronization continues for the employee's other prayers.
- Provide a "Resume automatic sync" action that clears an individual override.
- Approved leave takes precedence. Punches remain available for audit, but the worker does not change attendance while leave applies.
- Existing historical rows without automation metadata remain unchanged unless included in an explicit administrator-approved backfill.

## 3. Daily creation and reconciliation engine

Create shared server-side services used by both the worker and manual administration actions:

```ts
ensureMosqueAttendanceSheets(date): EnsureResult
reconcileMosqueAttendanceDate(date, employeeIds?): ReconcileResult
importZktecoPunches(options): ImportResult
importEtimePunches(options): ImportResult
```

### Sheet creation

- Replace scheduled-time prefilling with blank attendance creation.
- Use deterministic IDs such as `${date}_${employeeId}` for new rows.
- Before creation, recognize any existing legacy row for the employee/date and reuse it.
- Run creation through a Firestore transaction to prevent duplicates.
- Make the existing manual "Generate attendance" action call the same shared service.
- If duplicate legacy rows already exist, stop reconciliation for that employee/date and expose the conflict in administration instead of choosing silently.
- At worker startup, create every missing date between the last successful daily run and today.
- If prayer times are temporarily unavailable, still create the blank sheet and retry classification later.

### Prayer classification

For every eligible punch:

1. Convert the real UTC timestamp to Maldives local date and minute.
2. Load Innamaadhoo prayer times, using the existing Firestore fallback.
3. Partition the day using midpoints between adjacent prayer times.
4. Assign the punch to the prayer interval containing it.
5. Reject it when it is more than 90 minutes from that prayer's scheduled time.
6. Choose the earliest valid punch for each employee/prayer across both sources.
7. For an exact timestamp tie, choose ZKTeco deterministically while retaining both raw records.

Map prayer results to existing fields:

| Prayer | Attendance field | Lateness field |
|---|---|---|
| Fajr | `fathisSignInTime` | `fathisMinutesLate` |
| Dhuhr | `mendhuruSignInTime` | `mendhuruMinutesLate` |
| Asr | `asuruSignInTime` | `asuruMinutesLate` |
| Maghrib | `maqribSignInTime` | `maqribMinutesLate` |
| Isha | `ishaSignInTime` | `ishaMinutesLate` |

Calculate:

```text
expected arrival = prayer time - designation grace
minutes late = max(0, actual local minute - expected arrival)
```

Preserve the existing maximum lateness cap if required by the current schema.

For compatibility, continue writing attendance values in the local-component ISO format expected by the current UI, while canonical punch records retain real UTC timestamps. Centralize both conversions so browser and worker code cannot interpret them differently.

### Safe updates

- Reconciliation updates only automatically managed prayer fields.
- Never overwrite manual prayer overrides or approved leave.
- If a newly imported source reveals an earlier valid punch, update the automatically managed field to that earlier punch.
- If an eTime punch is validly voided, recalculate from remaining punches; return the prayer to `Absent` when no eligible punch remains.
- Use Firestore transactions to re-read override and leave state immediately before updating.
- Repeated imports, worker restarts, and repeated reconciliation must produce the same result without duplicate sheets or punches.

## 4. Always-on worker, administration, and rollout

### Worker process

Replace the single-purpose ZKTeco worker with `scripts/attendance-sync-worker.ts` containing independently supervised loops:

- ZKTeco:
  - Keep the existing frequent log-count polling.
  - Import new records in bounded batches.
  - Persist the last observed count and timestamp.
  - Detect log-count resets and report degraded status without deleting imported data.
- eTime:
  - Poll today every 5 minutes.
  - Re-query the previous two dates hourly to capture delayed uploads or corrections.
  - Manage CSRF tokens and session cookies internally.
  - Reauthenticate when redirected to login or when the session expires.
  - Validate required table columns and response date coverage before accepting a snapshot.
  - Use exponential retry with a maximum 15-minute delay during failures.
- Reconciliation:
  - Reconcile affected dates immediately after new or changed punches.
  - Run a complete reconciliation of yesterday at `00:15`.
  - Catch up from the last successful source date on restart, up to the portal's 62-day query limit.
- Daily creation:
  - Ensure today's sheets at startup and at `00:05`.
  - Record the last successful created date.

Use a Firestore lease renewed every 20 seconds with a 60-second expiry so only one worker instance actively imports and reconciles.

Run the worker as an auto-start Windows service on an always-on LAN machine that can reach ZKTeco and the internet. Store Firebase and eTime credentials only in service environment variables or an ACL-protected environment file. Never expose credentials through browser APIs, Firestore, or logs.

### Status and administrator controls

Track separate status documents for ZKTeco, eTime, sheet creation, and reconciliation, including heartbeat, last success, last source timestamp, counts, unmatched records, parser errors, and current lease owner.

Add administrator-only endpoints:

- `GET /api/admin/attendance-sync/status`
- `POST /api/admin/attendance-sync/test` with `{ source }`
- `POST /api/admin/attendance-sync/run` with:
  - Date range
  - Selected sources
  - `preview` or `apply` mode
  - Maximum 62-day eTime window

Expand the current device panel to show:

- Source health and stale-heartbeat warnings.
- Last successful import and reconciliation.
- Missing or duplicate employee mappings.
- Unmatched punches.
- Duplicate attendance rows.
- Preview results before historical changes.
- Per-prayer punch source for audit.

### Rollout

1. Add normalized types, indexes, source mappings, blank sheet creation, and reconciliation tests.
2. Populate and verify the six known employee mappings.
3. Start the worker in preview mode for at least two full attendance days.
4. Compare its selected punches and lateness against both raw sources and current sheets.
5. Enable automatic writes for the current date forward.
6. Enable Windows auto-start and restart-on-failure.
7. Leave pre-rollout historical records untouched.
8. Perform historical synchronization only through preview-then-apply administration.
9. For current/future rows created by the old prefill behavior, clear a value only when it exactly equals the generated prayer-minus-grace placeholder, has no approved leave, and was never manually changed.

## 5. Test and acceptance plan

### Automated tests

- eTime login, CSRF/session renewal, HTML parsing, ignored rows, malformed responses, and authoritative snapshot voiding using saved sanitized fixtures.
- ZKTeco normalization, log-count increase/reset, bounded catch-up, duplicate imports, and unmatched user IDs.
- Maldives date conversion around midnight and Fajr.
- Prayer midpoint and exact 90-minute boundaries.
- One-source-only punches and punches present on both machines.
- Multiple punches for one prayer and deterministic earliest selection.
- Exact timestamp ties.
- No-punch prayers remaining `null`.
- Imam and Council Assistant lateness thresholds.
- Manual override, manually cleared attendance, leave protection, and resuming automation.
- Worker restart, duplicate worker lease, repeated reconciliation, and concurrent manual editing.
- Missing prayer times, source outage, parser changes, and partial portal responses.
- Daily sheet creation after one-day and multi-day downtime.
- Legacy-row reuse and duplicate-row detection.

Add focused attendance-sync tests and run TypeScript plus targeted lint checks. Per repository instructions, do not run a production build unless separately requested.

### Acceptance criteria

- Every eligible employee has exactly one daily sheet by `00:10` Maldives time.
- A ZKTeco punch appears in the sheet within 30 seconds under normal conditions.
- An eTime punch appears within 10 minutes.
- A punch reported by only one source is still used.
- The earliest valid punch across both sources is selected.
- No source outage or parser failure clears valid attendance.
- No punch leaves the corresponding prayer as `Absent`.
- Late timings display red using the existing grace rules.
- Restarts and repeated imports create no duplicate punch or attendance records.
- Manual overrides and approved leave remain unchanged.
- Administrators can identify the selected source punch and diagnose stale or unmatched data.

## Assumptions

- The two sources are the local ZKTeco device and the eTime/TeamOffice raw-data portal.
- The worker will run on an always-on Windows machine with ZKTeco LAN access.
- All configured active Mosque Imams and Council Assistants are included, rather than only the current six.
- Near-real-time synchronization, a 90-minute validity guard, and preservation of manual edits and leave are the selected defaults.
- External email/SMS alerting is not included initially; health is exposed through the administrator panel and service logs.
