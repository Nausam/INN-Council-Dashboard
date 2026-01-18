/* eslint-disable @typescript-eslint/no-explicit-any */
import { Query } from "appwrite";
import type {
  ApiResponse,
  PaginatedResponse,
} from "../../../lib/types/database";
import { APPWRITE_CONFIG, databases, ID } from "../app/appwrite";

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

  // when creating, you can optionally pass votes
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

/* ============================== Service ============================== */

class NinmunService {
  private databaseId = APPWRITE_CONFIG.databaseId;

  // your main table: councilge-ninmun
  private ninmunCollectionId = APPWRITE_CONFIG.councilNinmunCollectionId;

  // create this table: ninmun_votes
  private votesCollectionId = APPWRITE_CONFIG.ninmunVotesCollectionId;

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

      const created = await databases.createDocument(
        this.databaseId,
        this.ninmunCollectionId,
        ID.unique(),
        data,
      );

      // If votes provided, upsert them (5 rows usually)
      if (input.votes?.length) {
        await this.upsertVotes(created.$id, input.votes);
      }

      return { success: true, data: created as unknown as Ninmun };
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
      const res = await databases.getDocument(
        this.databaseId,
        this.ninmunCollectionId,
        id,
      );
      return { success: true, data: res as unknown as Ninmun };
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
      const queries: string[] = [];

      if (filters?.search) {
        // If you want to search multiple fields, do multiple Query.search calls
        // (Appwrite treats them as AND, so you may prefer searching only title)
        queries.push(Query.search("title", filters.search));
      }

      queries.push(Query.orderDesc("$createdAt"));

      const limit = filters?.limit ?? 10;
      const offset = filters?.offset ?? 0;
      queries.push(Query.limit(limit));
      queries.push(Query.offset(offset));

      const res = await databases.listDocuments(
        this.databaseId,
        this.ninmunCollectionId,
        queries,
      );

      return {
        success: true,
        data: {
          documents: res.documents as unknown as Ninmun[],
          total: res.total,
          limit,
          offset,
        },
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
      const updateData: any = {};

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

      const res = await databases.updateDocument(
        this.databaseId,
        this.ninmunCollectionId,
        id,
        updateData,
      );

      if (input.votes?.length) {
        await this.upsertVotes(id, input.votes);
      }

      return { success: true, data: res as unknown as Ninmun };
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
      // delete votes first
      const votesRes = await this.listVotesForNinmun(id);
      if (votesRes.success && votesRes.data?.length) {
        await Promise.all(
          votesRes.data.map((v: any) =>
            databases.deleteDocument(
              this.databaseId,
              this.votesCollectionId,
              v.$id,
            ),
          ),
        );
      }

      await databases.deleteDocument(
        this.databaseId,
        this.ninmunCollectionId,
        id,
      );
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting ninmun:", error);
      return {
        success: false,
        error: error.message || "Failed to delete ninmun",
      };
    }
  }

  /* ============================== Votes ============================== */

  async listVotesForNinmun(
    ninmunId: string,
  ): Promise<ApiResponse<NinmunVote[]>> {
    try {
      const res = await databases.listDocuments(
        this.databaseId,
        this.votesCollectionId,
        [Query.equal("ninmunId", ninmunId), Query.limit(200)],
      );

      return { success: true, data: res.documents as unknown as NinmunVote[] };
    } catch (error: any) {
      console.error("Error listing votes:", error);
      return {
        success: false,
        error: error.message || "Failed to list votes",
      };
    }
  }

  /**
   * Upsert votes by (ninmunId + councillorId).
   * Requires UNIQUE index on (ninmunId, councillorId) in Appwrite.
   */
  private async upsertVotes(
    ninmunId: string,
    votes: Array<{
      councillorId: string;
      vote: NinmunVoteValue;
      note?: string | null;
    }>,
  ): Promise<void> {
    // naive but reliable: for each councillor, check existing then update/create
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
          await databases.updateDocument(
            this.databaseId,
            this.votesCollectionId,
            found.$id,
            payload,
          );
        } else {
          await databases.createDocument(
            this.databaseId,
            this.votesCollectionId,
            ID.unique(),
            payload,
          );
        }
      }),
    );
  }
}

export const ninmunService = new NinmunService();
