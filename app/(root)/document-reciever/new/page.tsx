"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createCorrespondence } from "@/lib/actions/correspondence.actions";
import { fetchAllEmployees } from "@/lib/appwrite/appwrite";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  CORRESPONDENCE_CHANNELS,
  CORRESPONDENCE_FIELD_LIMITS,
  CORRESPONDENCE_STATUSES,
  STATUS_LABELS,
} from "@/types/correspondence";
import { ArrowLeft, FilePlus2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type EmployeeOption = { $id: string; name: string };

const controlShell =
  "w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium shadow-sm transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100";

/** Single-line inputs/selects: fixed height so they match the channel control (overrides Input h-9). */
const controlClass = cn(controlShell, "h-12 py-0");

const fieldClass = cn(controlClass, "text-slate-900");

const selectClass = cn(controlClass, "text-slate-700");

const notesFieldClass = cn(
  controlShell,
  "min-h-[120px] resize-y py-3 text-slate-900",
);

export default function NewDocumentRecieverPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

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
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await createCorrespondence(fd);
      if (res.ok) {
        toast({ title: "Saved", description: "Document registered." });
        router.push(`/document-reciever/${res.id}`);
        return;
      }
      toast({
        variant: "destructive",
        title: "Could not save",
        description: res.error,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-96 w-96 rounded-full bg-indigo-100/30 blur-3xl" />
        <div className="absolute -right-48 top-96 h-96 w-96 rounded-full bg-violet-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <Link
          href="/document-reciever"
          className="group mb-8 inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white/80 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-slate-300 hover:bg-white hover:shadow-md"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
          Back to registry
        </Link>

        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg">
            <FilePlus2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Register a document
            </h1>
            <p className="mt-1 text-slate-600">
              Log a received document; optional PDF or image attachment.
            </p>
          </div>
        </div>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Details</CardTitle>
            <p className="text-sm text-slate-500">
              Fields match what is stored for each registry record.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="referenceNumber" className="text-slate-700">
                    Reference number (optional)
                  </Label>
                  <Input
                    id="referenceNumber"
                    name="referenceNumber"
                    maxLength={CORRESPONDENCE_FIELD_LIMITS.referenceNumber}
                    placeholder="Auto if blank"
                    className={fieldClass}
                  />
                  <p className="text-xs text-slate-500">
                    Max {CORRESPONDENCE_FIELD_LIMITS.referenceNumber} chars.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel" className="text-slate-700">
                    Channel
                  </Label>
                  <select
                    id="channel"
                    name="channel"
                    required
                    className={selectClass}
                    defaultValue="letter"
                  >
                    {CORRESPONDENCE_CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {CHANNEL_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="status" className="text-slate-700">
                    Status
                  </Label>
                  <select
                    id="status"
                    name="status"
                    required
                    className={selectClass}
                    defaultValue="pending"
                  >
                    {CORRESPONDENCE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject" className="text-slate-700">
                  Subject (document title)
                </Label>
                <Input
                  id="subject"
                  name="subject"
                  required
                  maxLength={CORRESPONDENCE_FIELD_LIMITS.subject}
                  placeholder="Short title or description"
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
                    maxLength={CORRESPONDENCE_FIELD_LIMITS.senderOrganization}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="receivedAt" className="text-slate-700">
                    Received at
                  </Label>
                  <Input
                    id="receivedAt"
                    name="receivedAt"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className={fieldClass}
                  />
                  <p className="text-xs text-slate-500">
                    Start of day (UTC) in the database.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueAt" className="text-slate-700">
                    Due at (optional)
                  </Label>
                  <Input
                    id="dueAt"
                    name="dueAt"
                    type="date"
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="assignedToUserId" className="text-slate-700">
                    Assigned to (optional)
                  </Label>
                  <select
                    id="assignedToUserId"
                    name="assignedToUserId"
                    className={selectClass}
                    defaultValue=""
                  >
                    <option value="">— None —</option>
                    {employees.map((emp) => (
                      <option key={emp.$id} value={emp.$id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                  placeholder="Summary, internal notes, or other context"
                  className={notesFieldClass}
                />
                <p className="text-xs text-slate-500">
                  Max {CORRESPONDENCE_FIELD_LIMITS.notes} characters.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file" className="text-slate-700">
                  Attachment (optional)
                </Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                  className={cn(
                    fieldClass,
                    "cursor-pointer file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700",
                  )}
                />
                <p className="text-xs text-slate-500">
                  PDF, JPEG, PNG, or WebP. Max 20 MB.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="min-w-[120px] rounded-xl bg-indigo-500 font-semibold hover:bg-indigo-600"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="rounded-xl border-slate-200"
                >
                  <Link href="/document-reciever">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
