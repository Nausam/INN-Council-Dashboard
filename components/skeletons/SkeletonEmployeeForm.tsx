import { CouncilCard } from "@/components/design-system";
import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonEmployeeForm() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6 px-4 py-8 lg:px-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <CouncilCard interactive="none" className="h-48 p-6" />
      <CouncilCard interactive="none" className="h-64 p-6" />
      <CouncilCard interactive="none" className="h-48 p-6" />
    </div>
  );
}
