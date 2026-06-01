import { CouncilCard } from "@/components/design-system";
import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonWasteTable() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-32 rounded-xl" />
      </div>
      <CouncilCard interactive="none" className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-4 py-3">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-slate-50 px-4 py-4 last:border-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CouncilCard>
    </div>
  );
}
