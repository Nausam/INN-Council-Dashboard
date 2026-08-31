export const dynamic = "force-dynamic";

import { LandRentOverviewView } from "./LandRentOverviewView";
import { fetchLandRentOverview } from "@/lib/landrent/landRent.actions";
import type { LandRentOverviewUIRow } from "@/components/landRent/Overview/landRentOverview.utils";

export default async function LandRentPage() {
  const rows = (await fetchLandRentOverview()) as LandRentOverviewUIRow[];
  return <LandRentOverviewView initialRows={rows} />;
}
