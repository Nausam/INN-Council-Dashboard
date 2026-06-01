import { CouncilCard } from "@/components/design-system";
import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonUploadSlipsPage() {
  return (
    <div className="animate-pulse space-y-6">
      <Skeleton className="h-11 w-28 rounded-xl" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>

      <CouncilCard interactive="none" className="p-6">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </CouncilCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <CouncilCard key={i} interactive="none" className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-11 rounded-xl" />
              <Skeleton className="h-11 rounded-xl" />
              <Skeleton className="h-11 w-36 rounded-xl" />
            </div>
          </CouncilCard>
        ))}
      </div>
    </div>
  );
}
