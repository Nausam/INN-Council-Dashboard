"use client";

export default function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Table skeleton (desktop) */}
      <div className="hidden md:block rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden relative">
        {/* soft colorful wash */}
        <div className="pointer-events-none absolute inset-0 opacity-55 bg-[radial-gradient(900px_360px_at_10%_0%,rgba(56,189,248,.18),transparent_55%),radial-gradient(900px_360px_at_55%_0%,rgba(139,92,246,.14),transparent_55%),radial-gradient(900px_360px_at_95%_0%,rgba(16,185,129,.14),transparent_55%)]" />

        <div className="relative">
          {/* Header row */}
          <div className="bg-slate-50 px-4 py-3">
            <div className="grid grid-cols-4 gap-4">
              <div className="h-3 w-24 rounded bg-slate-200/70 animate-pulse" />
              <div className="h-3 w-24 rounded bg-slate-200/70 animate-pulse" />
              <div className="h-3 w-24 rounded bg-slate-200/70 animate-pulse" />
              <div className="h-3 w-16 rounded bg-slate-200/70 animate-pulse justify-self-end" />
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-4">
                <div className="grid grid-cols-4 gap-4 items-center">
                  {/* Tenant cell */}
                  <div className="space-y-2">
                    <div className="h-4 w-44 rounded bg-slate-200/70 animate-pulse" />
                    <div className="h-3 w-56 rounded bg-slate-200/60 animate-pulse" />
                  </div>

                  {/* Agreement chip */}
                  <div className="h-9 w-40 rounded-xl bg-slate-200/60 animate-pulse" />

                  {/* Outstanding */}
                  <div className="h-4 w-28 rounded bg-slate-200/70 animate-pulse" />

                  {/* Action button */}
                  <div className="justify-self-end h-10 w-28 rounded-xl bg-gradient-to-r from-indigo-500/40 via-sky-500/40 to-emerald-500/40 animate-pulse" />
                </div>

                {/* subtle progress line */}
                <div className="mt-3 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full w-[55%] rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <div className="h-3 w-20 rounded bg-slate-200/60 animate-pulse" />
            <div className="h-3 w-40 rounded bg-slate-200/60 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Mobile cards skeleton (matches OverviewCards vibe) */}
      <div className="md:hidden grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 overflow-hidden relative"
          >
            <div className="pointer-events-none absolute inset-0 opacity-45 bg-[radial-gradient(700px_280px_at_10%_0%,rgba(56,189,248,.18),transparent_55%),radial-gradient(700px_280px_at_90%_0%,rgba(16,185,129,.14),transparent_55%)]" />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-4 w-44 rounded bg-slate-200/70 animate-pulse" />
                  <div className="h-3 w-56 rounded bg-slate-200/60 animate-pulse" />
                </div>
                <div className="h-8 w-20 rounded-full bg-slate-200/60 animate-pulse" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="h-3 w-16 rounded bg-slate-200/60 animate-pulse" />
                  <div className="mt-2 h-5 w-24 rounded bg-slate-200/70 animate-pulse" />
                </div>
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="h-3 w-20 rounded bg-slate-200/60 animate-pulse" />
                  <div className="mt-2 h-5 w-28 rounded bg-slate-200/70 animate-pulse" />
                </div>
              </div>

              <div className="mt-4 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 animate-pulse" />
              </div>

              <div className="mt-4 h-10 w-full rounded-xl bg-gradient-to-r from-indigo-500/40 via-sky-500/40 to-emerald-500/40 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
