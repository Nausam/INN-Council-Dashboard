import { CouncilCard } from "@/components/design-system";
import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonDocumentDetail() {
  return (
    <div className="animate-pulse space-y-6">
      <Skeleton className="h-11 w-28 rounded-xl" />
      <CouncilCard interactive="none" className="p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </CouncilCard>
      <CouncilCard interactive="none" className="h-48 p-6">
        <Skeleton className="mb-4 h-5 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </CouncilCard>
    </div>
  );
}
