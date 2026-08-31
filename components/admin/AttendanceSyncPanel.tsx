"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CloudDownload,
  RefreshCcw,
  Router,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SyncStatusPayload = {
  previewMode: boolean;
  autoWrite: boolean;
  unmatchedPunches: number;
  lease: {
    ownerId: string;
    expiresAt: string;
  } | null;
  mapping: {
    eligibleToday: number;
    duplicateZkIds: string[];
    duplicateEtimeCodes: string[];
    bootstrapConfigured: number;
  };
  zk: {
    config: {
      enabled: boolean;
      configured: boolean;
      ip: string;
      port: number;
      timezone: string;
      errors: string[];
    };
    status: {
      running?: boolean;
      lastHeartbeatAt?: string | null;
      lastError?: string | null;
      lastWriteAt?: string | null;
    } | null;
    recentPunches: Array<{
      $id: string;
      timestamp?: string | null;
      timestampUtc?: string | null;
      source?: string;
      displayEmployeeName?: string | null;
      matchedEmployeeName?: string | null;
    }>;
  };
  etime: {
    config: {
      enabled: boolean;
      configured: boolean;
      errors: string[];
    };
    status: {
      lastHeartbeatAt?: string | null;
      lastError?: string | null;
      lastSuccessfulDate?: string | null;
    } | null;
  };
  sheets: {
    lastSuccessAt?: string | null;
    lastDate?: string | null;
  } | null;
  reconcile: {
    lastSuccessAt?: string | null;
    lastDate?: string | null;
  } | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function isStale(value?: string | null, thresholdMs = 5 * 60 * 1000): boolean {
  if (!value) return true;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > thresholdMs;
}

export function AttendanceSyncPanel() {
  const [status, setStatus] = useState<SyncStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [mode, setMode] = useState<"preview" | "apply">("preview");
  const [sources, setSources] = useState({ zkteco: true, etime: true });

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/attendance-sync/status", {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load sync status");
      setStatus(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const staleWarnings = useMemo(() => {
    if (!status) return [];
    const warnings: string[] = [];
    if (isStale(status.zk.status?.lastHeartbeatAt, 60_000)) {
      warnings.push("ZKTeco heartbeat is stale — restart the attendance-sync worker.");
    }
    if (
      status.etime.config.enabled &&
      isStale(status.etime.status?.lastHeartbeatAt, 15 * 60 * 1000)
    ) {
      warnings.push("eTime heartbeat is stale — worker has not polled the portal yet.");
    }
    if (status.unmatchedPunches > 0) {
      warnings.push(`${status.unmatchedPunches}+ unmatched punch records.`);
    }
    if (status.mapping.duplicateZkIds.length > 0) {
      warnings.push("Duplicate ZKTeco user mappings detected.");
    }
    if (status.mapping.duplicateEtimeCodes.length > 0) {
      warnings.push("Duplicate eTime code mappings detected.");
    }
    return warnings;
  }, [status]);

  const runTest = async (source: "zkteco" | "etime") => {
    setTesting(source);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/attendance-sync/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Connection test failed");
      setMessage(
        source === "zkteco"
          ? `ZKTeco OK. Logs: ${body.logCount ?? "-"}, users: ${body.userCount ?? "-"}.`
          : body.message ?? "eTime connection OK.",
      );
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setTesting(null);
    }
  };

  const runSync = async () => {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const selected = [
        sources.zkteco ? "zkteco" : null,
        sources.etime ? "etime" : null,
      ].filter(Boolean);

      const res = await fetch("/api/admin/attendance-sync/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          mode,
          sources: selected,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Sync run failed");

      const zkWritten = body.imports?.zkteco?.written ?? 0;
      const etimeWritten = body.imports?.etime?.written ?? 0;
      const updated = Array.isArray(body.reconcile)
        ? body.reconcile.reduce(
            (sum: number, row: { updatedCount?: number }) =>
              sum + (row.updatedCount ?? 0),
            0,
          )
        : 0;

      setMessage(
        `${mode === "preview" ? "Preview" : "Apply"} complete. ZK written=${zkWritten}, eTime written=${etimeWritten}, reconcile updates=${updated}.`,
      );
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Router className="h-5 w-5" />
          Attendance Sync
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => void loadStatus()} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
        {message ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Badge variant={status?.previewMode ? "secondary" : "default"}>
            {status?.previewMode ? "Preview mode" : "Auto-write enabled"}
          </Badge>
          <Badge variant={status?.zk.status?.running ? "default" : "outline"}>
            ZK {status?.zk.status?.running ? "running" : "idle"}
          </Badge>
          <Badge variant={status?.etime.config.enabled ? "default" : "outline"}>
            eTime {status?.etime.config.enabled ? "enabled" : "disabled"}
          </Badge>
          {status?.lease ? (
            <Badge variant="outline">Lease: {status.lease.ownerId}</Badge>
          ) : null}
        </div>

        {staleWarnings.length > 0 ? (
          <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
            {staleWarnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border p-3 text-sm">
            <div className="mb-2 font-medium">ZKTeco</div>
            <div>IP: {status?.zk.config.ip || "-"}:{status?.zk.config.port ?? "-"}</div>
            <div>Heartbeat: {formatDateTime(status?.zk.status?.lastHeartbeatAt)}</div>
            <div>Last write: {formatDateTime(status?.zk.status?.lastWriteAt)}</div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={testing === "zkteco"}
                onClick={() => void runTest("zkteco")}
              >
                Test
              </Button>
            </div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="mb-2 font-medium">eTime</div>
            <div>Configured: {status?.etime.config.configured ? "Yes" : "No"}</div>
            <div>Heartbeat: {formatDateTime(status?.etime.status?.lastHeartbeatAt)}</div>
            <div>Last date: {status?.etime.status?.lastSuccessfulDate ?? "-"}</div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={testing === "etime" || !status?.etime.config.enabled}
                onClick={() => void runTest("etime")}
              >
                Test
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border p-3 text-sm">
            <div className="mb-1 font-medium">Sheet creation</div>
            <div>Last date: {status?.sheets?.lastDate ?? "-"}</div>
            <div>Last success: {formatDateTime(status?.sheets?.lastSuccessAt)}</div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="mb-1 font-medium">Reconciliation</div>
            <div>Last date: {status?.reconcile?.lastDate ?? "-"}</div>
            <div>Last success: {formatDateTime(status?.reconcile?.lastSuccessAt)}</div>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <CloudDownload className="h-4 w-4" />
            Manual run
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as "preview" | "apply")}
            >
              <option value="preview">Preview</option>
              <option value="apply">Apply</option>
            </select>
            <Button onClick={() => void runSync()} disabled={running}>
              {running ? "Running..." : "Run sync"}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sources.zkteco}
                onChange={(e) =>
                  setSources((prev) => ({ ...prev, zkteco: e.target.checked }))
                }
              />
              ZKTeco
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sources.etime}
                onChange={(e) =>
                  setSources((prev) => ({ ...prev, etime: e.target.checked }))
                }
              />
              eTime
            </label>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" />
            Recent punches
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Employee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(status?.zk.recentPunches ?? []).map((row) => (
                <TableRow key={row.$id}>
                  <TableCell>
                    {formatDateTime(row.timestampUtc ?? row.timestamp)}
                  </TableCell>
                  <TableCell>{row.source ?? "zkteco"}</TableCell>
                  <TableCell>
                    {row.displayEmployeeName ?? row.matchedEmployeeName ?? "Unmatched"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
