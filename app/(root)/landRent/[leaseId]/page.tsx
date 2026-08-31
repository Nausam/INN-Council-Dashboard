export const dynamic = "force-dynamic";

import {
  fetchLandLeaseOptions,
  fetchLandStatementsWithDetails,
} from "@/lib/landrent/landRent.actions";
import { LandRentStatementView } from "./LandRentStatementView";

export default async function LandRentStatementPage({
  params,
}: {
  params: { leaseId: string };
}) {
  const [options, statements] = await Promise.all([
    fetchLandLeaseOptions(),
    fetchLandStatementsWithDetails({
      leaseId: params.leaseId,
      capToEndDate: false,
    }),
  ]);
  return (
    <LandRentStatementView
      leaseId={params.leaseId}
      options={options}
      statements={statements}
    />
  );
}
