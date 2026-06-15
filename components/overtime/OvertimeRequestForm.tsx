"use client";

import {
  CouncilCard,
  CouncilTimePicker,
  SearchField,
  SectionBadge,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployeesQuery, useQueryInvalidation } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { recordCardLabelForEmployee } from "@/lib/employees/record-card-label";
import { createOvertimeRequest } from "@/lib/firebase/hr";
import { formatJoinedDate } from "@/lib/salary-slips/format";
import type { EmployeeDoc } from "@/lib/firebase/types";
import { cn } from "@/lib/utils";
import {
  Clock,
  FileText,
  Timer,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import React, { useMemo, useState } from "react";

const COUNCIL_OFFICE = "INNAMADHOO COUNCIL";

type OvertimeFormState = {
  details: string;
  startTime: string;
  endTime: string;
};

function computeOtMinutes(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (
    !Number.isFinite(sh) ||
    !Number.isFinite(sm) ||
    !Number.isFinite(eh) ||
    !Number.isFinite(em)
  ) {
    return null;
  }
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes;
}

function formatOtDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function FormSection({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <CouncilCard interactive="none" className={cn("p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
      </div>
      {children}
    </CouncilCard>
  );
}

function EmployeeInfoCard({ employee }: { employee: EmployeeDoc }) {
  const recordLabel = recordCardLabelForEmployee(
    employee.section,
    employee.designation,
  );
  const recordValue = employee.recordCardNumber?.trim() || "—";

  const fields: Array<{ label: string; value: string }> = [
    { label: recordLabel, value: recordValue },
    { label: "Name", value: employee.name?.trim() || "—" },
    { label: "Designation", value: employee.designation?.trim() || "—" },
    { label: "Section", value: employee.section?.trim() || "—" },
    { label: "Address", value: employee.address?.trim() || "—" },
    { label: "Office", value: COUNCIL_OFFICE },
    {
      label: "Joined Date",
      value: formatJoinedDate(employee.joinedDate),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{employee.name}</p>
        {employee.section?.trim() && (
          <SectionBadge section={employee.section} />
        )}
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {fields.map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {label}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-800 break-words">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function OvertimeRequestForm() {
  const { data: employees = [], isLoading } = useEmployeesQuery();
  const { invalidateOvertimeRequests } = useQueryInvalidation();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<OvertimeFormState>({
    details: "",
    startTime: "",
    endTime: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const sortedEmployees = useMemo(
    () =>
      [...employees]
        .filter((e) => e.name?.trim())
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedEmployees;
    return sortedEmployees.filter((e) => {
      const haystack = [
        e.name,
        e.designation,
        e.section,
        e.recordCardNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedEmployees, search]);

  const selectedEmployees = useMemo(
    () => sortedEmployees.filter((e) => selectedIds.has(e.$id)),
    [sortedEmployees, selectedIds],
  );

  const otMinutes = computeOtMinutes(form.startTime, form.endTime);

  const toggleEmployee = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const e of filteredEmployees) next.add(e.$id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedEmployees.length === 0) {
      toast({
        title: "Select employees",
        description: "Choose at least one employee for this OT request.",
        variant: "destructive",
      });
      return;
    }

    if (!form.details.trim()) {
      toast({
        title: "OT details required",
        description: "Describe the overtime work.",
        variant: "destructive",
      });
      return;
    }

    if (!form.startTime || !form.endTime) {
      toast({
        title: "Times required",
        description: "Set both start and end time.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await createOvertimeRequest({
        details: form.details.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        durationMinutes: otMinutes ?? 0,
        employees: selectedEmployees.map((employee) => ({
          employeeId: employee.$id,
          name: employee.name?.trim() || "—",
          designation: employee.designation?.trim() || undefined,
          section: employee.section?.trim() || undefined,
          recordCardNumber: employee.recordCardNumber?.trim() || undefined,
          recordCardLabel: recordCardLabelForEmployee(
            employee.section,
            employee.designation,
          ),
          address: employee.address?.trim() || undefined,
          joinedDate: employee.joinedDate?.trim() || undefined,
        })),
      });
      await invalidateOvertimeRequests();
      toast({
        title: "OT request submitted",
        description: `${selectedEmployees.length} employee(s) · ${formatOtDuration(otMinutes ?? 0)}`,
      });
      setForm({ details: "", startTime: "", endTime: "" });
      clearSelection();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not submit the overtime request.";
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <FormSection icon={Users} title="Employees">
        <SearchField
          placeholder="Search by name, designation, or card no…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-600">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              onClick={selectAllFiltered}
              disabled={filteredEmployees.length === 0}
            >
              Select all shown
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
              onClick={clearSelection}
              disabled={selectedIds.size === 0}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-[min(420px,50vh)] overflow-y-auto rounded-xl border border-slate-200/90 bg-white">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No employees match your search.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredEmployees.map((employee) => {
                const checked = selectedIds.has(employee.$id);
                return (
                  <li key={employee.$id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                        checked ? "bg-teal-50/80" : "hover:bg-slate-50",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        checked={checked}
                        onChange={() => toggleEmployee(employee.$id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {employee.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {employee.designation ?? "—"}
                          {employee.recordCardNumber
                            ? ` · ${employee.recordCardNumber}`
                            : ""}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </FormSection>

      <div className="space-y-6">
        <FormSection icon={FileText} title="OT Details">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="ot-details"
                className="text-xs font-semibold text-slate-600"
              >
                Details
              </label>
              <textarea
                id="ot-details"
                rows={4}
                required
                placeholder="Describe the overtime work, location, or task…"
                value={form.details}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, details: e.target.value }))
                }
                className="council-input min-h-[7rem] resize-y py-3 text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="ot-start"
                  className="text-xs font-semibold text-slate-600"
                >
                  Start time
                </label>
                <CouncilTimePicker
                  id="ot-start"
                  value={form.startTime}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, startTime: value }))
                  }
                  placeholder="Start"
                  icon={Clock}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="ot-end"
                  className="text-xs font-semibold text-slate-600"
                >
                  End time
                </label>
                <CouncilTimePicker
                  id="ot-end"
                  value={form.endTime}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, endTime: value }))
                  }
                  placeholder="End"
                  icon={Timer}
                />
              </div>
            </div>

            {otMinutes !== null && (
              <p className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-100">
                <Timer className="h-4 w-4 shrink-0" />
                Duration: {formatOtDuration(otMinutes)}
              </p>
            )}
          </div>
        </FormSection>

        <FormSection icon={User} title="Selected employees">
          {selectedEmployees.length === 0 ? (
            <p className="text-sm text-slate-500">
              Select employees from the list to see their details here.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedEmployees.map((employee) => (
                <EmployeeInfoCard key={employee.$id} employee={employee} />
              ))}
            </div>
          )}
        </FormSection>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="council-outline"
            className="h-11 rounded-xl px-6"
            onClick={() => {
              setForm({ details: "", startTime: "", endTime: "" });
              clearSelection();
            }}
            disabled={submitting}
          >
            Reset
          </Button>
          <Button
            type="submit"
            variant="council"
            className="h-11 rounded-xl px-8"
            disabled={submitting || isLoading}
          >
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </div>
    </form>
  );
}
