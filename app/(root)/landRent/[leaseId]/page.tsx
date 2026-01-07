import { getLandRentMonthlyDetails } from "@/lib/landrent/landRent.actions";

export default async function Page({
  params,
  searchParams,
}: {
  params: { leaseId: string };
  searchParams: { month?: string };
}) {
  const monthKey = searchParams.month ?? "2026-01";
  const d = await getLandRentMonthlyDetails({
    leaseId: params.leaseId,
    monthKey,
  });

  // map d -> your template props (same as before)
  return <div className="bg-white">{/* render your template here */}</div>;
}
