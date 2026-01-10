"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  addMonthsToMonthKey,
  getThisMonthKey,
  toDatetimeLocalValue,
} from "@/components/landRent/Statement/landRentStatement.utils";
import {
  createLandRentPayment,
  createLandStatement,
  fetchLandLeaseOptions,
  fetchLandStatementsWithDetails,
  previewLandRentStatement,
  type LandLeaseOption,
} from "@/lib/landrent/landRent.actions";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type StatementDetails = Awaited<
  ReturnType<typeof fetchLandStatementsWithDetails>
>[number];

export type PreviewDetails = Awaited<
  ReturnType<typeof previewLandRentStatement>
>;

export function useLandRentStatementPage() {
  const searchParams = useSearchParams();
  const latestInvoiceRef = useRef<HTMLDivElement>(null);

  const [options, setOptions] = useState<LandLeaseOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [leaseId, setLeaseId] = useState<string>(
    searchParams.get("leaseId") ?? ""
  );
  const [monthKey, setMonthKey] = useState<string>(
    searchParams.get("monthKey") ?? getThisMonthKey()
  );
  const [capToEndDate, setCapToEndDate] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<PreviewDetails | null>(null);
  const [statements, setStatements] = useState<StatementDetails[]>([]);

  const [creatingStatement, setCreatingStatement] = useState(false);

  // Payment form
  const [payAmount, setPayAmount] = useState<string>("");
  const [payAtLocal, setPayAtLocal] = useState<string>(
    toDatetimeLocalValue(new Date())
  );
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [payReference, setPayReference] = useState<string>("");
  const [payNote, setPayNote] = useState<string>("");
  const [payReceivedBy, setPayReceivedBy] = useState<string>("");

  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentOk, setPaymentOk] = useState<string | null>(null);

  // Load lease options
  useEffect(() => {
    let alive = true;
    setLoadingOptions(true);
    setError(null);

    fetchLandLeaseOptions()
      .then((opts) => {
        if (!alive) return;
        setOptions(opts);
        setLeaseId((prev) => prev || (opts[0]?.leaseId ?? ""));
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message ?? "Failed to load leases.");
      })
      .finally(() => {
        if (!alive) return;
        setLoadingOptions(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const statementForSelectedMonth = useMemo(() => {
    return statements.find((s) => s.statement.monthKey === monthKey) ?? null;
  }, [statements, monthKey]);

  const openStatement = useMemo(() => {
    return statements.find((s) => s.statement.status === "OPEN") ?? null;
  }, [statements]);

  const latestStatement = useMemo(() => {
    if (!statements.length) return null;
    return statements
      .slice()
      .sort((a, b) => a.statement.monthKey.localeCompare(b.statement.monthKey))
      .slice(-1)[0];
  }, [statements]);

  const monthPickerDisabled = !!openStatement;

  const previewSource = useMemo(() => {
    if (openStatement) return openStatement;
    if (statementForSelectedMonth) return statementForSelectedMonth;
    return preview;
  }, [openStatement, statementForSelectedMonth, preview]);

  const canCreateStatement = useMemo(
    () => !!leaseId && !openStatement,
    [leaseId, openStatement]
  );

  const nextMonthKeySuggestion = useMemo(() => {
    if (!latestStatement) return monthKey;
    return addMonthsToMonthKey(latestStatement.statement.monthKey, 1);
  }, [latestStatement, monthKey]);

  const canCreateNextStatement = useMemo(() => {
    if (!leaseId) return false;
    if (openStatement) return false;
    if (!latestStatement) return false;
    return latestStatement.statement.status === "PAID";
  }, [leaseId, openStatement, latestStatement]);

  async function refreshAll() {
    if (!leaseId) {
      setStatements([]);
      setPreview(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [rows, prev] = await Promise.all([
        fetchLandStatementsWithDetails({ leaseId, capToEndDate }),
        previewLandRentStatement({ leaseId, monthKey, capToEndDate }),
      ]);

      const open =
        rows.find((r) => r.statement.status === "OPEN")?.statement ?? null;

      if (open) {
        setMonthKey(open.monthKey);
      } else {
        const hasSelected = rows.some((r) => r.statement.monthKey === monthKey);
        if (!hasSelected) {
          const latest = rows
            .slice()
            .sort((a, b) =>
              a.statement.monthKey.localeCompare(b.statement.monthKey)
            )
            .slice(-1)[0];
          if (latest) setMonthKey(latest.statement.monthKey);
        }
      }

      setStatements(rows);
      setPreview(prev);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load.");
      setStatements([]);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  // refresh on lease or cap changes
  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId, capToEndDate]);

  // re-preview on month change when no OPEN statement
  useEffect(() => {
    if (!leaseId) return;
    if (openStatement) return;

    let alive = true;
    setLoading(true);
    setError(null);

    previewLandRentStatement({ leaseId, monthKey, capToEndDate })
      .then((p) => {
        if (!alive) return;
        setPreview(p);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message ?? "Failed to preview.");
        setPreview(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [leaseId, monthKey, capToEndDate, openStatement]);

  async function createStatement() {
    if (!leaseId) return;

    setCreatingStatement(true);
    setError(null);
    setPaymentOk(null);
    setPaymentError(null);

    try {
      await createLandStatement({
        leaseId,
        monthKey,
        createdBy: payReceivedBy || "",
        capToEndDate,
      });

      await refreshAll();
      setPaymentOk("Statement created.");
    } catch (e: any) {
      setError(
        e?.message ?? e?.response?.message ?? "Failed to create statement."
      );
    } finally {
      setCreatingStatement(false);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!openStatement) return;

    setSavingPayment(true);
    setPaymentOk(null);
    setPaymentError(null);

    try {
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Enter a valid amount.");

      const paidAt = new Date(payAtLocal);
      if (Number.isNaN(paidAt.getTime()))
        throw new Error("Invalid payment date/time.");

      await createLandRentPayment({
        statementId: openStatement.statement.$id,
        paidAt: paidAt.toISOString(),
        amount,
        method: payMethod || "",
        reference: payReference || "",
        note: payNote || "",
        receivedBy: payReceivedBy || "",
        capToEndDate,
      });

      setPayAmount("");
      setPayReference("");
      setPayNote("");

      await refreshAll();
      setPaymentOk("Payment saved.");
    } catch (err: any) {
      setPaymentError(err?.message ?? "Failed to save payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  const selectedLabel = useMemo(() => {
    const o = options.find((x) => x.leaseId === leaseId);
    if (!o) return "";
    return `${o.landName} — ${o.tenantName}`;
  }, [options, leaseId]);

  return {
    // state
    options,
    loadingOptions,

    leaseId,
    setLeaseId,

    monthKey,
    setMonthKey,

    capToEndDate,
    setCapToEndDate,

    loading,
    error,

    preview,
    statements,

    openStatement,
    latestStatement,
    statementForSelectedMonth,

    previewSource,

    monthPickerDisabled,
    canCreateStatement,
    canCreateNextStatement,
    nextMonthKeySuggestion,

    // payment state
    payAmount,
    setPayAmount,
    payAtLocal,
    setPayAtLocal,
    payMethod,
    setPayMethod,
    payReference,
    setPayReference,
    payNote,
    setPayNote,
    payReceivedBy,
    setPayReceivedBy,

    savingPayment,
    paymentError,
    paymentOk,

    creatingStatement,

    // actions
    refreshAll,
    createStatement,
    submitPayment,

    // refs
    latestInvoiceRef,

    // labels
    selectedLabel,
  };
}
