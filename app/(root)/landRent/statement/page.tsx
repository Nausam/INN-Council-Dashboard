import { redirect } from "next/navigation";

export default function LegacyLandRentStatementPage({
  searchParams,
}: {
  searchParams: { leaseId?: string; monthKey?: string };
}) {
  const leaseId = searchParams.leaseId?.trim();
  if (!leaseId) redirect("/landRent");

  const monthKey = searchParams.monthKey;
  const monthQuery = monthKey
    ? `?monthKey=${encodeURIComponent(monthKey)}`
    : "";

  redirect(`/landRent/${encodeURIComponent(leaseId)}${monthQuery}`);
}
