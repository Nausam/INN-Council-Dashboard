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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  archiveCorrespondence,
  deleteCorrespondence,
  getCorrespondenceById,
  updateCorrespondence,
} from "@/lib/actions/correspondence.actions";
import { isCorrespondenceOverdue } from "@/lib/correspondence/overdue";
import { fetchAllEmployees } from "@/lib/appwrite/appwrite";
import { cn } from "@/lib/utils";
import type { CorrespondenceDoc } from "@/types/correspondence";
import {
  CHANNEL_LABELS,
  CORRESPONDENCE_CHANNELS,
  CORRESPONDENCE_FIELD_LIMITS,
  CORRESPONDENCE_STATUSES,
  STATUS_LABELS,
} from "@/types/correspondence";
import { format, parseISO } from "date-fns";
import {
  Archive,
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type EmployeeOption = { $id: string; name: string };

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white py-3.5 px-4 text-slate-900 shadow-sm transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100";

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white py-3.5 px-4 text-sm font-medium text-slate-700 shadow-sm transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100";

export default function DocumentRecieverDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { toast } = useToast();

  const [doc, setDoc] = useState<CorrespondenceDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [removeFile, setRemoveFile] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const row = (await getCorrespondenceById(id)) as CorrespondenceDoc;
      setDoc(row);
      setRemoveFile(false);
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Not found",
        description: "This document record could not be loaded.",
      });
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchAllEmployees();
        setEmployees(
          list.map((e) => ({
            $id: e.$id,
            name: typeof e.name === "string" ? e.name : "Unknown",
          })),
        );
      } catch {
        setEmployees([]);
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (removeFile) fd.set("removeFile", "1");
      const res = await updateCorrespondence(id, fd);
      if (res.ok) {
        toast({ title: "Updated" });
        await load();
        return;
      }
      toast({
        variant: "destructive",
        title: "Update failed",
        description: res.error,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onArchive() {
    if (!id || !doc) return;
    if (!window.confirm("Archive this document? It will be marked archived.")) {
      return;
    }
    setArchiving(true);
    try {
      const res = await archiveCorrespondence(id);
      if (res.ok) {
        toast({ title: "Archived" });
        router.push("/document-reciever");
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not archive",
        description: res.error,
      });
    } finally {
      setArchiving(false);
    }
  }

  async function onConfirmDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      const res = await deleteCorrespondence(id);
      if (res.ok) {
        toast({
          title: "Deleted",
          description:
            "The registry entry and any stored attachment were removed.",
        });
        setDeleteDialogOpen(false);
        router.push("/document-reciever");
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not delete",
        description: res.error,
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-48 -top-48 h-96 w-96 rounded-full bg-indigo-100/30 blur-3xl" />
        </div>
        <div className="relative flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="relative mx-auto flex max-w-lg flex-col items-center justify-center gap-4 px-4 py-20">
          <p className="text-center text-sm text-slate-600">
            This document could not be loaded.
          </p>
          <Link
            href="/document-reciever"
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600"
          >
            Back to registry
          </Link>
        </div>
      </div>
    );
  }

  const overdue = isCorrespondenceOverdue(doc);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-96 w-96 rounded-full bg-indigo-100/30 blur-3xl" />
        <div className="absolute -right-48 top-96 h-96 w-96 rounded-full bg-violet-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-8 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/document-reciever"
            className="group inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white/80 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-sm transition-all hover:border-slate-300 hover:bg-white hover:shadow-md"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to registry
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {doc.storageFileId ? (
              <Button variant="outline" size="sm" asChild className="rounded-xl border-slate-200">
                <a
                  href={`/api/document-reciever/${doc.$id}/file`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open attachment
                </a>
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={archiving}
              onClick={onArchive}
              className="rounded-xl border-slate-200"
            >
              {archiving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 rounded-xl border-slate-200 text-rose-700 hover:bg-rose-50"
              disabled={deleting || archiving}
              aria-label="Delete registry entry permanently"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 opacity-20 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-xl shadow-indigo-500/30">
              <FileText className="h-8 w-8" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Document detail
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex max-w-full items-center gap-2 rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-1 ring-1 ring-indigo-200/50">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                <span className="truncate text-sm font-bold text-indigo-700">
                  {doc.referenceNumber}
                </span>
              </div>
            </div>
          </div>
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this registry entry?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes{" "}
                <span className="font-mono font-medium text-foreground">
                  {doc.referenceNumber}
                </span>{" "}
                from the database
                {doc.storageFileId
                  ? " and deletes the attachment file from storage."
                  : "."}{" "}
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() => void onConfirmDelete()}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete permanently"
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
            {doc.subject}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-800">
              {CHANNEL_LABELS[doc.channel] ?? doc.channel}
            </Badge>
            <Badge variant="secondary" className="bg-slate-100 text-slate-800">
              {STATUS_LABELS[doc.status] ?? doc.status}
            </Badge>
            {overdue ? (
              <Badge variant="destructive" className="font-normal">
                Overdue
              </Badge>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Received{" "}
            {doc.receivedAt
              ? format(parseISO(doc.receivedAt), "dd MMM yyyy HH:mm")
              : "—"}
            {doc.$createdAt
              ? ` · Logged ${format(parseISO(doc.$createdAt), "dd MMM yyyy")}`
              : null}
          </p>
        </div>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Edit details</CardTitle>
            <p className="text-sm text-slate-500">
              Update metadata stored in the document receiver registry.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="referenceNumber" className="text-slate-700">
                  Reference number
                </Label>
                <Input
                  id="referenceNumber"
                  name="referenceNumber"
                  defaultValue={doc.referenceNumber}
                  required
                  maxLength={CORRESPONDENCE_FIELD_LIMITS.referenceNumber}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel" className="text-slate-700">
                  Channel (how it was received)
                </Label>
                <select
                  id="channel"
                  name="channel"
                  required
                  className={selectClass}
                  defaultValue={doc.channel}
                >
                  {CORRESPONDENCE_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject" className="text-slate-700">
                  Subject (document title)
                </Label>
                <Input
                  id="subject"
                  name="subject"
                  defaultValue={doc.subject}
                  required
                  maxLength={CORRESPONDENCE_FIELD_LIMITS.subject}
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="senderName" className="text-slate-700">
                    Sender name
                  </Label>
                  <Input
                    id="senderName"
                    name="senderName"
                    defaultValue={doc.senderName}
                    required
                    maxLength={CORRESPONDENCE_FIELD_LIMITS.senderName}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderOrganization" className="text-slate-700">
                    Sender organization (optional)
                  </Label>
                  <Input
                    id="senderOrganization"
                    name="senderOrganization"
                    defaultValue={doc.senderOrganization ?? ""}
                    maxLength={CORRESPONDENCE_FIELD_LIMITS.senderOrganization}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="receivedAt" className="text-slate-700">
                    Received at (date)
                  </Label>
                  <Input
                    id="receivedAt"
                    name="receivedAt"
                    type="date"
                    required
                    defaultValue={toDateInput(doc.receivedAt)}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueAt" className="text-slate-700">
                    Due at (optional)
                  </Label>
                  <Input
                    id="dueAt"
                    name="dueAt"
                    type="date"
                    defaultValue={toDateInput(doc.dueAt)}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-slate-700">
                  Status
                </Label>
                <select
                  id="status"
                  name="status"
                  required
                  className={selectClass}
                  defaultValue={doc.status}
                >
                  {CORRESPONDENCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              {doc.answeredAt ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-medium text-indigo-900">Answered at</span>
                  <span className="ml-2 font-mono text-xs sm:text-sm">
                    {format(parseISO(doc.answeredAt), "dd MMM yyyy HH:mm")}
                  </span>
                  <p className="mt-1 text-xs text-slate-600">
                    Set automatically when status is &quot;Answered&quot;.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="assignedToUserId" className="text-slate-700">
                  Assigned to (optional)
                </Label>
                <select
                  id="assignedToUserId"
                  name="assignedToUserId"
                  className={selectClass}
                  defaultValue={doc.assignedToUserId ?? ""}
                >
                  <option value="">— None —</option>
                  {employees.map((emp) => (
                    <option key={emp.$id} value={emp.$id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-slate-700">
                  Notes (optional)
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={5}
                  maxLength={CORRESPONDENCE_FIELD_LIMITS.notes}
                  defaultValue={doc.notes ?? ""}
                  placeholder="Summary and internal notes"
                  className={cn(fieldClass, "min-h-[120px] resize-y py-3")}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <Label className="text-slate-700">Attachment</Label>
                {doc.storageFileId && !removeFile ? (
                  <p className="text-sm text-slate-600">
                    Current:{" "}
                    <span className="font-medium">{doc.fileName ?? "file"}</span>
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">No file attached.</p>
                )}
                {doc.storageFileId ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={removeFile}
                      onChange={(e) => setRemoveFile(e.target.checked)}
                    />
                    Remove current file
                  </label>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="file" className="text-slate-700">
                    {doc.storageFileId ? "Replace with new file" : "Add file"}
                  </Label>
                  <Input
                    id="file"
                    name="file"
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                    className={cn(
                      fieldClass,
                      "cursor-pointer py-3 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700",
                    )}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-500 font-semibold hover:bg-indigo-600"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save changes"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

