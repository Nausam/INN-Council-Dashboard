import { CouncilCard } from "@/components/design-system";
import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonEmployeesPage() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl pl-12" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CouncilCard key={i} interactive="none" className="p-5">
            <div className="mb-4 flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="mt-4 h-10 w-full rounded-xl" />
          </CouncilCard>
        ))}
      </div>
    </div>
  );
}
