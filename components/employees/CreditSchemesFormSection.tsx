"use client";

import { AddCreditSchemeNameModal } from "@/components/employees/AddCreditSchemeNameModal";
import { CouncilCard } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { CouncilDatePicker } from "@/components/design-system/council-date-picker";
import {
  createCreditScheme,
  type CreditSchemeEntry,
} from "@/lib/employees/credit-schemes";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronDown,
  CreditCard,
  DollarSign,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";

const fieldClass =
  "council-input h-11 pl-10 pr-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60";

type CreditSchemesFormSectionProps = {
  schemes: CreditSchemeEntry[];
  onChange: (schemes: CreditSchemeEntry[]) => void;
};

export function CreditSchemesFormSection({
  schemes,
  onChange,
}: CreditSchemesFormSectionProps) {
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const setSchemeExpanded = (id: string, open: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const updateScheme = (
    id: string,
    patch: Partial<Omit<CreditSchemeEntry, "id">>,
  ) => {
    onChange(
      schemes.map((scheme) =>
        scheme.id === id ? { ...scheme, ...patch } : scheme,
      ),
    );
  };

  const removeScheme = (id: string) => {
    onChange(schemes.filter((scheme) => scheme.id !== id));
    setExpandedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const addScheme = (name: string) => {
    const entry = createCreditScheme(name);
    onChange([...schemes, entry]);
    setExpandedIds((prev) => new Set(prev).add(entry.id));
  };

  return (
    <div className="space-y-4">
      <AddCreditSchemeNameModal
        open={nameModalOpen}
        onOpenChange={setNameModalOpen}
        onConfirm={addScheme}
      />
      {schemes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-600">
            No credit schemes yet. Add a scheme with start and end dates and
            monthly amounts.
          </p>
        </div>
      ) : (
        schemes.map((scheme, index) => (
          <CreditSchemeCollapsibleCard
            key={scheme.id}
            scheme={scheme}
            index={index}
            open={expandedIds.has(scheme.id)}
            onOpenChange={(open) => setSchemeExpanded(scheme.id, open)}
            onUpdate={(patch) => updateScheme(scheme.id, patch)}
            onRemove={() => removeScheme(scheme.id)}
          />
        ))
      )}

      <Button
        type="button"
        variant="council-outline"
        className="h-11 w-full rounded-xl sm:w-auto"
        onClick={() => setNameModalOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Add credit scheme
      </Button>
    </div>
  );
}

function CreditSchemeCollapsibleCard({
  scheme,
  index,
  open,
  onOpenChange,
  onUpdate,
  onRemove,
}: {
  scheme: CreditSchemeEntry;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (patch: Partial<Omit<CreditSchemeEntry, "id">>) => void;
  onRemove: () => void;
}) {
  const title = scheme.name.trim() || `Scheme ${index + 1}`;

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CouncilCard interactive="none" className="overflow-hidden p-0">
        <div className="flex items-center gap-2 p-4 sm:px-5 sm:py-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group/trigger flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-colors hover:bg-slate-50/80 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-black text-slate-900">
                  {title}
                </h4>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            aria-label={`Remove ${title}`}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <CollapsibleContent className="overflow-hidden transition-all duration-200 ease-out">
          <div className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5 sm:pb-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <SchemeNameField
                schemeId={scheme.id}
                value={scheme.name}
                onChange={(value) => onUpdate({ name: value })}
              />
              <SchemeDateField
                schemeId={scheme.id}
                fieldKey="start-date"
                label="Start date"
                value={scheme.startDate}
                onChange={(value) => onUpdate({ startDate: value })}
              />
              <SchemeDateField
                schemeId={scheme.id}
                fieldKey="end-date"
                label="End date"
                value={scheme.endDate}
                onChange={(value) => onUpdate({ endDate: value })}
              />
              <SchemeAmountField
                schemeId={scheme.id}
                fieldKey="start-amount"
                label="Start month amount (MVR)"
                value={scheme.startMonthAmount}
                onChange={(value) => onUpdate({ startMonthAmount: value })}
              />
              <SchemeAmountField
                schemeId={scheme.id}
                fieldKey="end-amount"
                label="End month amount (MVR)"
                value={scheme.endMonthAmount}
                onChange={(value) => onUpdate({ endMonthAmount: value })}
              />
            </div>
          </div>
        </CollapsibleContent>
      </CouncilCard>
    </Collapsible>
  );
}

function SchemeNameField({
  schemeId,
  value,
  onChange,
}: {
  schemeId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = `${schemeId}-name`;

  return (
    <div className="sm:col-span-2">
      <label
        htmlFor={fieldId}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        Scheme name
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Tag className="h-4 w-4" />
        </div>
        <input
          id={fieldId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
      </div>
    </div>
  );
}

function SchemeDateField({
  schemeId,
  fieldKey,
  label,
  value,
  onChange,
}: {
  schemeId: string;
  fieldKey: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = `${schemeId}-${fieldKey}`;

  return (
    <div>
      <label
        className="mb-2 block text-sm font-semibold text-slate-700"
        htmlFor={fieldId}
      >
        {label}
      </label>
      <CouncilDatePicker
        id={fieldId}
        name={fieldId}
        value={value}
        onChange={onChange}
        icon={Calendar}
        placeholder="Select date"
      />
    </div>
  );
}

function SchemeAmountField({
  schemeId,
  fieldKey,
  label,
  value,
  onChange,
}: {
  schemeId: string;
  fieldKey: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const fieldId = `${schemeId}-${fieldKey}`;

  return (
    <div>
      <label
        className="mb-2 block text-sm font-semibold text-slate-700"
        htmlFor={fieldId}
      >
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <DollarSign className="h-4 w-4" />
        </div>
        <input
          id={fieldId}
          name={fieldId}
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={fieldClass}
        />
      </div>
    </div>
  );
}
