import { CouncilCard } from "@/components/design-system";
import { Skeleton } from "@/components/ui/skeleton";

export function PageShellSkeleton({
  showHeader = true,
  cards = 3,
}: {
  showHeader?: boolean;
  cards?: number;
}) {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-6 px-4 py-8 lg:px-8">
      {showHeader ? (
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
      ) : null}
      {Array.from({ length: cards }).map((_, i) => (
        <CouncilCard key={i} interactive="none" className="h-32" />
      ))}
    </div>
  );
}
