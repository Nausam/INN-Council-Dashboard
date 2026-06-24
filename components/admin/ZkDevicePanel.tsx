"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, RefreshCcw, Router, Wifi } from "lucide-react";

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

type PunchRow = {
  $id: string;
  empId?: string;
  empName?: string | null;
  matchedEmployeeName?: string | null;
  displayEmployeeName?: string | null;
  empNameNorm?: string | null;
  timestamp?: string | null;
  deviceSn?: string;
  deviceUserId?: string;
};

type ZkStatusPayload = {
  config: {
    enabled: boolean;
    configured: boolean;
    ip: string;
    port: number;
    pollMs: number;
    timezone: string;
    errors: string[];
  };
  status: {
    running?: boolean;
    deviceSerial?: string | null;
    lastLogCount?: number | null;
    lastHeartbeatAt?: string | null;
    lastSyncStartedAt?: string | null;
    lastSyncCompletedAt?: string | null;
    lastWriteAt?: string | null;
    lastError?: string | null;
  } | null;
  latestPunch: PunchRow | null;
  recentPunches: PunchRow[];
};

type SyncResult = {
  scanned: number;
  valid: number;
  written: number;
  skipped: number;
  unmatched: number;
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

export function ZkDevicePanel() {
  const [status, setStatus] = useState<ZkStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/zk/status", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load device status");
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

  const runTest = async () => {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/zk/test", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Connection test failed");
      setMessage(
        `Connection OK. Logs: ${body.logCount ?? "-"}, users: ${body.userCount ?? "-"}.`,
      );
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/zk/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const body = (await res.json()) as SyncResult & { error?: string };
      if (!res.ok) throw new Error(body.error || "Sync failed");
      setMessage(
        `Sync complete. Written: ${body.written}, skipped: ${body.skipped}, unmatched: ${body.unmatched}.`,
      );
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const statusBadge = useMemo(() => {
    if (!status?.config.enabled) {
      return <Badge variant="outline">Disabled</Badge>;
    }
    if (!status.config.configured) {
      return <Badge variant="destructive">Needs config</Badge>;
    }
    if (status.status?.running) {
      return <Badge className="bg-emerald-600 text-white">Watching</Badge>;
    }
    return <Badge variant="secondary">Configured</Badge>;
  }, [status]);

  const recentPunches = status?.recentPunches ?? [];
  const unmatchedCount = recentPunches.filter(
    (row) => !row.displayEmployeeName,
  ).length;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
              <Router className="h-5 w-5 text-teal-700" />
              Fingerprint Device
            </CardTitle>
          </div>
          {statusBadge}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Device</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {status?.config.ip || "-"}:{status?.config.port ?? "-"}
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Serial</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {status?.status?.deviceSerial || "-"}
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Logs</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {status?.status?.lastLogCount ?? "-"}
            </p>
          </div>
          <div className="rounded-md border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Heartbeat</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatDateTime(status?.status?.lastHeartbeatAt)}
            </p>
          </div>
        </div>

        {status?.status?.lastError ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            {status.status.lastError}
          </div>
        ) : null}

        {unmatchedCount > 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            {unmatchedCount} recent punch{unmatchedCount === 1 ? "" : "es"} did not match an employee.
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                From
              </label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                To
              </label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={runTest}
            disabled={loading || testing || syncing}
          >
            <Wifi className="h-4 w-4" />
            {testing ? "Testing..." : "Test connection"}
          </Button>

          <Button
            type="button"
            variant="council"
            className="h-10"
            onClick={runSync}
            disabled={loading || testing || syncing || !from}
          >
            <RefreshCcw className="h-4 w-4" />
            {syncing ? "Syncing..." : "Sync punches"}
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Employee</TableHead>
                <TableHead>Device ID</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPunches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500">
                    {loading ? "Loading punches..." : "No punches found."}
                  </TableCell>
                </TableRow>
              ) : (
                recentPunches.map((row) => (
                  <TableRow key={row.$id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-teal-700" />
                        {row.displayEmployeeName || "Unmatched"}
                      </span>
                    </TableCell>
                    <TableCell>{row.deviceUserId || row.empId || "-"}</TableCell>
                    <TableCell>{formatDateTime(row.timestamp)}</TableCell>
                    <TableCell>{row.deviceSn || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
