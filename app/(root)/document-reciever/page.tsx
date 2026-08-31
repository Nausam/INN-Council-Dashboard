export const dynamic = "force-dynamic";

import {
  getCorrespondenceDashboardStats,
  listCorrespondence,
} from "@/lib/actions/correspondence.actions";
import { searchParamString } from "@/lib/dates/page-params";
import type { CorrespondenceStatus } from "@/types/correspondence";
import { DocumentRecieverListView } from "./DocumentRecieverListView";

export default async function DocumentRecieverPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    status?: string;
    page?: string;
  };
}) {
  const status = (searchParamString(searchParams?.status) ||
    "all") as CorrespondenceStatus | "all";
  const page = Math.max(0, Number(searchParamString(searchParams?.page) || 0));
  const search = searchParamString(searchParams?.q) || undefined;

  const [initialList, initialStats] = await Promise.all([
    listCorrespondence({
      limit: 25,
      offset: page * 25,
      status,
      search,
    }),
    getCorrespondenceDashboardStats(),
  ]);

  return (
    <DocumentRecieverListView
      initialList={initialList}
      initialStats={initialStats}
    />
  );
}
