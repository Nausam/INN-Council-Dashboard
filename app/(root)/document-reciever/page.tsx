"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/Dashboard/StatCard";
import { useToast } from "@/hooks/use-toast";
import {
  deleteCorrespondence,
  exportCorrespondenceCsv,
  getCorrespondenceDashboardStats,
  listCorrespondence,
} from "@/lib/actions/correspondence.actions";
import { isCorrespondenceOverdue } from "@/lib/correspondence/overdue";
import { cn } from "@/lib/utils";
import type { CorrespondenceDoc, CorrespondenceStatus } from "@/types/correspondence";
import {
  CHANNEL_LABELS,
  CORRESPONDENCE_STATUSES,
  STATUS_LABELS,
} from "@/types/correspondence";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  ChevronRight,
  Download,
  FileStack,
  Filter,
  Inbox,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaInbox } from "react-icons/fa";

const PAGE_SIZE = 25;

const controlShell =
  "w-full rounded-xl border border-slate-200 bg-white text-sm font-medium shadow-sm transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100";

const fieldClass = `${controlShell} h-12 px-4 py-0 text-slate-900`;

const selectClass = `${controlShell} h-12 appearance-none pl-10 pr-10 py-0 text-slate-700 hover:border-slate-300`;

const searchFieldClass = `${controlShell} h-12 py-0 pl-12 pr-4 text-slate-900 placeholder-slate-400`;

function statusBadgeVariant(
  status: CorrespondenceStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
      return "secondary";
    case "answered":
      return "default";
    case "no_response_required":
      return "outline";
    case "archived":
      return "outline";
    default:
      return "secondary";
  }
}

function DocumentRegistryCard({
  row,
  onDelete,
}: {
  row: CorrespondenceDoc;
  onDelete: (row: CorrespondenceDoc) => void;
}) {
  const overdue = isCorrespondenceOverdue(row);
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
        "transition-all duration-200 hover:border-indigo-200 hover:shadow-md",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <Link
          href={`/document-reciever/${row.$id}`}
          className="min-w-0 flex-1"
        >
          <p className="font-mono text-xs font-semibold text-indigo-600">
            {row.referenceNumber}
          </p>
          <h3 className="mt-1 line-clamp-2 text-lg font-bold tracking-tight text-slate-900">
            {row.subject}
          </h3>
        </Link>
        <button
          type="button"
          className="shrink-0 rounded-xl p-2 text-rose-600 transition-colors hover:bg-rose-50"
          aria-label={`Delete ${row.referenceNumber}`}
          onClick={() => onDelete(row)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm font-medium text-slate-700">{row.senderName}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {CHANNEL_LABELS[row.channel] ?? row.channel}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={statusBadgeVariant(row.status)} className="font-normal">
          {STATUS_LABELS[row.status] ?? row.status}
        </Badge>
        {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>
            Received{" "}
            {row.receivedAt
              ? format(parseISO(row.receivedAt), "dd MMM yyyy")
              : "—"}
          </span>
          {row.dueAt ? (
            <span>Due {format(parseISO(row.dueAt), "dd MMM yyyy")}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {row.storageFileId ? (
            <a
              href={`/api/document-reciever/${row.$id}/file`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              View file
            </a>
          ) : null}
          <Link
            href={`/document-reciever/${row.$id}`}
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Open
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function RegistryCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-6 w-full max-w-[200px] rounded bg-slate-200" />
        </div>
        <div className="h-9 w-9 rounded-xl bg-slate-200" />
      </div>
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="mt-3 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-slate-200" />
      </div>
      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        <div className="h-3 w-40 rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default function DocumentRecieverListPage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<CorrespondenceDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<{
    pending: number;
    overdue: number;
    answeredThisWeek: number;
  } | null>(null);

  const [status, setStatus] = useState<CorrespondenceStatus | "all">("all");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedTo, setReceivedTo] = useState("");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CorrespondenceDoc | null>(
    null,
  );
  const [listDeleting, setListDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await getCorrespondenceDashboardStats();
        const data = raw as {
          pending: number;
          overdue: number;
          answeredThisWeek: number;
        };
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await listCorrespondence({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status,
        receivedFrom: receivedFrom || undefined,
        receivedTo: receivedTo || undefined,
        search: search || undefined,
      });
      const data = raw as { documents: CorrespondenceDoc[]; total: number };
      setDocuments(data.documents);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Could not load documents",
        description:
          e instanceof Error ? e.message : "Check Appwrite collection env vars.",
      });
      setDocuments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, status, receivedFrom, receivedTo, search, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasActiveFilters =
    status !== "all" ||
    receivedFrom !== "" ||
    receivedTo !== "" ||
    search.trim() !== "";

  function resetFilters() {
    setPage(0);
    setStatus("all");
    setReceivedFrom("");
    setReceivedTo("");
    setSearch("");
  }

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportCorrespondenceCsv({
        status,
        receivedFrom: receivedFrom || undefined,
        receivedTo: receivedTo || undefined,
        search: search || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `document-receiver-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export started" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setExporting(false);
    }
  }

  async function confirmDeleteFromList() {
    if (!pendingDelete) return;
    setListDeleting(true);
    try {
      const res = await deleteCorrespondence(pendingDelete.$id);
      if (res.ok) {
        toast({
          title: "Deleted",
          description:
            "The registry entry and any stored attachment were removed.",
        });
        setPendingDelete(null);
        await load();
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not delete",
        description: res.error,
      });
    } finally {
      setListDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg">
              <Inbox className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                Documents
              </h1>
              <p className="mt-1 text-slate-600">
                {loading
                  ? "Loading…"
                  : `${total} matching ${total === 1 ? "record" : "records"}`}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExport()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 text-slate-500" />
              )}
              Export CSV
            </button>
            <Link
              href="/document-reciever/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-600"
            >
              <Plus className="h-4 w-4" />
              Register document
            </Link>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {stats ? (
            <>
              <StatCard
                icon={FaInbox}
                label="Pending"
                value={stats.pending}
                colorScheme="indigo"
                compact
              />
              <StatCard
                icon={FaExclamationTriangle}
                label="Overdue"
                value={stats.overdue}
                colorScheme="amber"
                compact
              />
              <StatCard
                icon={FaCheckCircle}
                label="Answered (week)"
                value={stats.answeredThisWeek}
                colorScheme="emerald"
                compact
              />
            </>
          ) : (
            <>
              <div className="h-40 animate-pulse rounded-3xl bg-slate-200/60" />
              <div className="h-40 animate-pulse rounded-3xl bg-slate-200/60" />
              <div className="h-40 animate-pulse rounded-3xl bg-slate-200/60" />
            </>
          )}
        </div>

        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by subject, sender, or reference…"
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              className={searchFieldClass}
            />
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={status}
                onChange={(e) => {
                  setPage(0);
                  setStatus(e.target.value as CorrespondenceStatus | "all");
                }}
                className={selectClass}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {CORRESPONDENCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Received from
                  </span>
                </label>
                <input
                  type="date"
                  value={receivedFrom}
                  onChange={(e) => {
                    setPage(0);
                    setReceivedFrom(e.target.value);
                  }}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Received to
                </label>
                <input
                  type="date"
                  value={receivedTo}
                  onChange={(e) => {
                    setPage(0);
                    setReceivedTo(e.target.value);
                  }}
                  className={fieldClass}
                />
              </div>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 lg:shrink-0"
              >
                Reset filters
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <RegistryCardSkeleton key={i} />
            ))}
          </div>
        ) : documents.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {documents.map((row) => (
                <DocumentRegistryCard
                  key={row.$id}
                  row={row}
                  onDelete={setPendingDelete}
                />
              ))}
            </div>
            {total > PAGE_SIZE ? (
              <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
                <p className="text-sm text-slate-500">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <FileStack className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              No records found
            </h3>
            <p className="mb-4 max-w-sm text-center text-sm text-slate-600">
              Try adjusting your search or filters, or register a new document.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-600"
                >
                  Clear filters
                </button>
              ) : null}
              <Link
                href="/document-reciever/new"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Register document
              </Link>
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this registry entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>
                  This permanently removes{" "}
                  <span className="font-mono font-medium text-foreground">
                    {pendingDelete.referenceNumber}
                  </span>{" "}
                  from the database
                  {pendingDelete.storageFileId
                    ? " and deletes the attachment file from storage."
                    : "."}{" "}
                  This cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={listDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={listDeleting}
              onClick={() => void confirmDeleteFromList()}
            >
              {listDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete permanently"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
