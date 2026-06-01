import SkeletonWasteTable from "@/components/skeletons/SkeletonWasteTable";
import { PageShell } from "@/components/design-system";

export default function Loading() {
  return (
    <PageShell>
      <SkeletonWasteTable />
    </PageShell>
  );
}
