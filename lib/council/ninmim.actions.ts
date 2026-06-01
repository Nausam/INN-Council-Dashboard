"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { COLLECTIONS } from "@/lib/firebase/admin";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listAllDocuments,
  newDocId,
  updateDocument,
  type WhereClause,
} from "@/lib/firebase/repository";
import type {
  ApiResponse,
  PaginatedResponse,
} from "@/lib/types/database";

/* ============================== Types ============================== */

export type Ninmun = {
  $id: string;
  publicationNumber: string;
  title: string;
  subtitle: string;
  issue: string;
  issuetakenby: string;
  issuepresentedby: string;
  finalnote: string;
  $createdAt: string;
  $updatedAt: string;
};

export type NinmunVoteValue = "FOR" | "AGAINST" | "ABSTAIN" | "ABSENT";

export type NinmunVote = {
  $id: string;
  ninmunId: string;
  councillorId: string;
  vote: NinmunVoteValue;
  note?: string | null;
  $createdAt: string;
  $updatedAt: string;
};

export type CreateNinmunInput = {
  publicationNumber: string;
  title: string;
  subtitle: string;
  issue: string;
  issuetakenby: string;
  issuepresentedby: string;
  finalnote: string;

  votes?: Array<{
    councillorId: string;
    vote: NinmunVoteValue;
    note?: string | null;
  }>;
};

export type UpdateNinmunInput = Partial<Omit<CreateNinmunInput, "votes">> & {
  votes?: Array<{
    councillorId: string;
    vote: NinmunVoteValue;
    note?: string | null;
  }>;
};

export type NinmunFilters = {
  search?: string;
  limit?: number;
  offset?: number;
};

/* ============================== Helpers ============================== */

function sortByCreatedDesc<T extends { $createdAt?: string }>(docs: T[]): T[] {
  return [...docs].sort(
    (a, b) =>
      new Date(b.$createdAt ?? 0).getTime() -
      new Date(a.$createdAt ?? 0).getTime(),
  );
}

function filterByTitleSearch<T extends { title?: string }>(
  docs: T[],
  search?: string,
): T[] {
  const q = search?.trim().toLowerCase();
  if (!q) return docs;
  return docs.filter((d) =>
    String(d.title ?? "")
      .toLowerCase()
      .includes(q),
  );
}

function paginate<T>(
  docs: T[],
  limit: number,
  offset: number,
): PaginatedResponse<T> {
  return {
    documents: docs.slice(offset, offset + limit),
    total: docs.length,
    limit,
    offset,
  };
}

/* ============================== Service ============================== */

class NinmunService {
  async createNinmun(input: CreateNinmunInput): Promise<ApiResponse<Ninmun>> {
    try {
      const data = {
        publicationNumber: input.publicationNumber,
        title: input.title,
        subtitle: input.subtitle,
        issue: input.issue,
        issuetakenby: input.issuetakenby,
        issuepresentedby: input.issuepresentedby,
        finalnote: input.finalnote,
      };

      const created = await createDocument<Ninmun>(
        COLLECTIONS.councilNinmun,
        data,
      );

      if (input.votes?.length) {
        await this.upsertVotes(created.$id, input.votes);
      }

      return { success: true, data: created };
    } catch (error: any) {
      console.error("Error creating ninmun:", error);
      return {
        success: false,
        error: error.message || "Failed to create ninmun",
      };
    }
  }

  async getNinmun(id: string): Promise<ApiResponse<Ninmun>> {
    try {
      const res = await getDocument<Ninmun>(COLLECTIONS.councilNinmun, id);
      return { success: true, data: res };
    } catch (error: any) {
      console.error("Error getting ninmun:", error);
      return {
        success: false,
        error: error.message || "Failed to get ninmun",
      };
    }
  }

  async getNinmunWithVotes(
    id: string,
  ): Promise<ApiResponse<{ ninmun: Ninmun; votes: NinmunVote[] }>> {
    try {
      const ninmun = await this.getNinmun(id);
      if (!ninmun.success || !ninmun.data)
        return { success: false, error: ninmun.error };

      const votes = await this.listVotesForNinmun(id);
      if (!votes.success || !votes.data)
        return { success: false, error: votes.error };

      return {
        success: true,
        data: { ninmun: ninmun.data, votes: votes.data },
      };
    } catch (error: any) {
      console.error("Error getting ninmun with votes:", error);
      return {
        success: false,
        error: error.message || "Failed to get ninmun with votes",
      };
    }
  }

  async listNinmun(
    filters?: NinmunFilters,
  ): Promise<ApiResponse<PaginatedResponse<Ninmun>>> {
    try {
      const limit = filters?.limit ?? 10;
      const offset = filters?.offset ?? 0;

      const all = await listAllDocuments<Ninmun>(COLLECTIONS.councilNinmun, {
        orderBy: [{ field: "$createdAt", direction: "desc" }],
      });

      const filtered = filterByTitleSearch(all, filters?.search);
      const sorted = sortByCreatedDesc(filtered);

      return {
        success: true,
        data: paginate(sorted, limit, offset),
      };
    } catch (error: any) {
      console.error("Error listing ninmun:", error);
      return {
        success: false,
        error: error.message || "Failed to list ninmun",
      };
    }
  }

  async updateNinmun(
    id: string,
    input: UpdateNinmunInput,
  ): Promise<ApiResponse<Ninmun>> {
    try {
      const updateData: Record<string, unknown> = {};

      if (typeof input.publicationNumber === "string")
        updateData.publicationNumber = input.publicationNumber;

      if (typeof input.title === "string") updateData.title = input.title;
      if (typeof input.subtitle === "string")
        updateData.subtitle = input.subtitle;
      if (typeof input.issue === "string") updateData.issue = input.issue;
      if (typeof input.issuetakenby === "string")
        updateData.issuetakenby = input.issuetakenby;
      if (typeof input.issuepresentedby === "string")
        updateData.issuepresentedby = input.issuepresentedby;
      if (typeof input.finalnote === "string")
        updateData.finalnote = input.finalnote;

      await updateDocument(COLLECTIONS.councilNinmun, id, updateData);

      if (input.votes?.length) {
        await this.upsertVotes(id, input.votes);
      }

      const res = await getDocument<Ninmun>(COLLECTIONS.councilNinmun, id);
      return { success: true, data: res };
    } catch (error: any) {
      console.error("Error updating ninmun:", error);
      return {
        success: false,
        error: error.message || "Failed to update ninmun",
      };
    }
  }

  async deleteNinmun(id: string): Promise<ApiResponse<void>> {
    try {
      const votesRes = await this.listVotesForNinmun(id);
      if (votesRes.success && votesRes.data?.length) {
        await Promise.all(
          votesRes.data.map((v: NinmunVote) =>
            deleteDocument(COLLECTIONS.ninmunVotes, v.$id),
          ),
        );
      }

      await deleteDocument(COLLECTIONS.councilNinmun, id);
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting ninmun:", error);
      return {
        success: false,
        error: error.message || "Failed to delete ninmun",
      };
    }
  }

  async listVotesForNinmun(
    ninmunId: string,
  ): Promise<ApiResponse<NinmunVote[]>> {
    try {
      const where: WhereClause[] = [["ninmunId", "==", ninmunId]];
      const res = await listAllDocuments<NinmunVote>(COLLECTIONS.ninmunVotes, {
        where,
      });

      return { success: true, data: res };
    } catch (error: any) {
      console.error("Error listing votes:", error);
      return {
        success: false,
        error: error.message || "Failed to list votes",
      };
    }
  }

  private async upsertVotes(
    ninmunId: string,
    votes: Array<{
      councillorId: string;
      vote: NinmunVoteValue;
      note?: string | null;
    }>,
  ): Promise<void> {
    const existing = await this.listVotesForNinmun(ninmunId);
    const byCouncillor = new Map<string, NinmunVote>();
    if (existing.success && existing.data) {
      for (const v of existing.data) byCouncillor.set(v.councillorId, v);
    }

    await Promise.all(
      votes.map(async (v) => {
        const found = byCouncillor.get(v.councillorId);
        const payload = {
          ninmunId,
          councillorId: v.councillorId,
          vote: v.vote,
          note: v.note ?? null,
        };

        if (found) {
          await updateDocument(COLLECTIONS.ninmunVotes, found.$id, payload);
        } else {
          await createDocument<NinmunVote>(
            COLLECTIONS.ninmunVotes,
            payload,
            newDocId(),
          );
        }
      }),
    );
  }
}

const _ninmunService = new NinmunService();

export async function createNinmun(input: CreateNinmunInput) {
  return _ninmunService.createNinmun(input);
}
export async function getNinmun(id: string) {
  return _ninmunService.getNinmun(id);
}
export async function getNinmunWithVotes(id: string) {
  return _ninmunService.getNinmunWithVotes(id);
}
export async function listNinmun(filters?: NinmunFilters) {
  return _ninmunService.listNinmun(filters);
}
export async function updateNinmun(id: string, input: UpdateNinmunInput) {
  return _ninmunService.updateNinmun(id, input);
}
export async function deleteNinmun(id: string) {
  return _ninmunService.deleteNinmun(id);
}
export async function listVotesForNinmun(ninmunId: string) {
  return _ninmunService.listVotesForNinmun(ninmunId);
}

export const ninmunService = {
  createNinmun,
  getNinmun,
  getNinmunWithVotes,
  listNinmun,
  updateNinmun,
  deleteNinmun,
  listVotesForNinmun,
};
