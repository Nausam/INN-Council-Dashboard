"use client";

import MonthlyCalculationPanel from "@/components/landRent/Statement/MonthlyCalculationPanel";
import StatementControls from "@/components/landRent/Statement/StatementControls";
import StatementsList from "@/components/landRent/Statement/StatementsList";
import { useLandRentStatementPage } from "@/components/landRent/Statement/useLandRentStatementPage";

function StatementPageSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 overflow-hidden">
      {/* soft colorful wash */}
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(900px_360px_at_10%_0%,rgba(56,189,248,.18),transparent_55%),radial-gradient(900px_360px_at_60%_10%,rgba(139,92,246,.14),transparent_55%),radial-gradient(900px_360px_at_95%_0%,rgba(16,185,129,.14),transparent_55%)]" />

      <div className="relative">
        {/* shimmer line */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-pulse" />

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* left big block */}
          <div className="lg:col-span-2 rounded-2xl bg-slate-50 ring-1 ring-slate-100 p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-4 w-44 rounded-lg bg-slate-200/70 animate-pulse" />
                <div className="h-3 w-64 rounded-lg bg-slate-200/60 animate-pulse" />
              </div>
              <div className="h-9 w-24 rounded-full bg-slate-200/70 animate-pulse" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-slate-200/70 animate-pulse" />
                    <div className="h-4 w-12 rounded-full bg-slate-200/60 animate-pulse" />
                  </div>
                  <div className="mt-4 h-3 w-24 rounded-lg bg-slate-200/60 animate-pulse" />
                  <div className="mt-2 h-7 w-32 rounded-xl bg-slate-200/70 animate-pulse" />
                  <div className="mt-3 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full w-[55%] rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* right progress block */}
          <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-100 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-4 w-36 rounded-lg bg-slate-200/70 animate-pulse" />
                <div className="h-3 w-52 rounded-lg bg-slate-200/60 animate-pulse" />
              </div>
              <div className="h-7 w-20 rounded-full bg-slate-200/70 animate-pulse" />
            </div>

            <div className="mt-5 h-10 w-44 rounded-2xl bg-slate-200/70 animate-pulse" />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
                <div className="h-3 w-12 rounded bg-slate-200/60 animate-pulse" />
                <div className="mt-2 h-6 w-28 rounded-xl bg-slate-200/70 animate-pulse" />
              </div>
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
                <div className="h-3 w-16 rounded bg-slate-200/60 animate-pulse" />
                <div className="mt-2 h-6 w-28 rounded-xl bg-slate-200/70 animate-pulse" />
              </div>
            </div>

            <div className="mt-4 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 animate-pulse" />
            </div>

            <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-slate-100">
              <div className="h-3 w-40 rounded bg-slate-200/60 animate-pulse" />
              <div className="mt-2 h-3 w-56 rounded bg-slate-200/60 animate-pulse" />
            </div>
          </div>
        </div>

        {/* list skeleton */}
        <div className="mt-5 rounded-2xl bg-slate-50 ring-1 ring-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 rounded bg-slate-200/70 animate-pulse" />
            <div className="h-8 w-20 rounded-full bg-slate-200/60 animate-pulse" />
          </div>

          <div className="mt-4 grid gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-3 w-44 rounded bg-slate-200/60 animate-pulse" />
                    <div className="h-3 w-28 rounded bg-slate-200/60 animate-pulse" />
                  </div>
                  <div className="h-8 w-24 rounded-xl bg-slate-200/70 animate-pulse" />
                </div>
                <div className="mt-3 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full w-[45%] rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* subtle moving gradient border */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-slate-100" />
      </div>
    </div>
  );
}

export default function Page() {
  const s = useLandRentStatementPage();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 space-y-6">
      <StatementControls
        options={s.options}
        loadingOptions={s.loadingOptions}
        leaseId={s.leaseId}
        setLeaseId={s.setLeaseId}
        monthKey={s.monthKey}
        setMonthKey={s.setMonthKey}
        monthPickerDisabled={s.monthPickerDisabled}
        error={s.error}
      />

      <MonthlyCalculationPanel
        previewSource={s.previewSource}
        capToEndDate={s.capToEndDate}
        setCapToEndDate={s.setCapToEndDate}
        openStatement={s.openStatement}
        canCreateStatement={s.canCreateStatement}
        creatingStatement={s.creatingStatement}
        onCreateStatement={s.createStatement}
        canCreateNextStatement={s.canCreateNextStatement}
        nextMonthKeySuggestion={s.nextMonthKeySuggestion}
        paymentOk={s.paymentOk}
        paymentError={s.paymentError}
        payAmount={s.payAmount}
        setPayAmount={s.setPayAmount}
        payAtLocal={s.payAtLocal}
        setPayAtLocal={s.setPayAtLocal}
        payMethod={s.payMethod}
        setPayMethod={s.setPayMethod}
        payReference={s.payReference}
        setPayReference={s.setPayReference}
        payNote={s.payNote}
        setPayNote={s.setPayNote}
        payReceivedBy={s.payReceivedBy}
        setPayReceivedBy={s.setPayReceivedBy}
        savingPayment={s.savingPayment}
        onSubmitPayment={s.submitPayment}
        onRefresh={s.refreshAll}
        leaseId={s.leaseId}
      />

      {s.loading ? (
        <StatementPageSkeleton />
      ) : s.statements.length ? (
        <StatementsList
          statements={s.statements}
          latestInvoiceRef={s.latestInvoiceRef}
        />
      ) : (
        <div className="flex items-center justify-center rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 text-slate-600">
          No statements yet. Create the first statement to generate the invoice.
        </div>
      )}
    </div>
  );
}
