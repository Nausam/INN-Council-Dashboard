import { PageShell } from "@/components/design-system";

export default function RootSegmentLoading() {
  return (
    <PageShell>
      <div className="animate-pulse space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-slate-200" />
          <div className="space-y-2">
            <div className="h-9 w-56 rounded-lg bg-slate-200" />
            <div className="h-4 w-72 rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-12 rounded-xl bg-slate-100" />
        <div className="h-64 rounded-2xl bg-slate-100" />
      </div>
    </PageShell>
  );
}
