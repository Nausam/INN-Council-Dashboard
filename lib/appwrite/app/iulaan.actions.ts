/* eslint-disable @typescript-eslint/no-explicit-any */
import { Query } from "appwrite";
import type {
  ApiResponse,
  PaginatedResponse,
} from "../../../lib/types/database";
import { APPWRITE_CONFIG, databases, ID } from "../app/appwrite";

/* ============================== Types ============================== */

export type Iulaan = {
  $id: string;
  iulaannumber: string;
  title: string;
  subtitle: string;
  content: string;
  fileurl?: string | null;
  $createdAt: string;
  $updatedAt: string;
};

export type CreateIulaanInput = {
  iulaannumber: string;
  title: string;
  subtitle: string;
  content: string;
  fileurl?: string | null;
};

export type UpdateIulaanInput = Partial<CreateIulaanInput>;

export type IulaanFilters = {
  search?: string;
  limit?: number;
  offset?: number;
};

/* ============================== Service ============================== */

class IulaanService {
  private databaseId = APPWRITE_CONFIG.databaseId;
  private iulaanCollectionId = APPWRITE_CONFIG.iulaanCollectionId; // Add this to your APPWRITE_CONFIG

  async createIulaan(input: CreateIulaanInput): Promise<ApiResponse<Iulaan>> {
    try {
      const data = {
        iulaannumber: input.iulaannumber,
        title: input.title,
        subtitle: input.subtitle,
        content: input.content,
        fileurl: input.fileurl ?? null,
      };

      const created = await databases.createDocument(
        this.databaseId,
        this.iulaanCollectionId,
        ID.unique(),
        data,
      );

      return { success: true, data: created as unknown as Iulaan };
    } catch (error: any) {
      console.error("Error creating iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to create iulaan",
      };
    }
  }

  async getIulaan(id: string): Promise<ApiResponse<Iulaan>> {
    try {
      const res = await databases.getDocument(
        this.databaseId,
        this.iulaanCollectionId,
        id,
      );
      return { success: true, data: res as unknown as Iulaan };
    } catch (error: any) {
      console.error("Error getting iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to get iulaan",
      };
    }
  }

  async listIulaan(
    filters?: IulaanFilters,
  ): Promise<ApiResponse<PaginatedResponse<Iulaan>>> {
    try {
      const queries: string[] = [];

      if (filters?.search) {
        // Search in title field
        queries.push(Query.search("title", filters.search));
      }

      queries.push(Query.orderDesc("$createdAt"));

      const limit = filters?.limit ?? 10;
      const offset = filters?.offset ?? 0;
      queries.push(Query.limit(limit));
      queries.push(Query.offset(offset));

      const res = await databases.listDocuments(
        this.databaseId,
        this.iulaanCollectionId,
        queries,
      );

      return {
        success: true,
        data: {
          documents: res.documents as unknown as Iulaan[],
          total: res.total,
          limit,
          offset,
        },
      };
    } catch (error: any) {
      console.error("Error listing iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to list iulaan",
      };
    }
  }

  async updateIulaan(
    id: string,
    input: UpdateIulaanInput,
  ): Promise<ApiResponse<Iulaan>> {
    try {
      const updateData: any = {};

      if (typeof input.iulaannumber === "string")
        updateData.iulaannumber = input.iulaannumber;
      if (typeof input.title === "string") updateData.title = input.title;
      if (typeof input.subtitle === "string")
        updateData.subtitle = input.subtitle;
      if (typeof input.content === "string") updateData.content = input.content;
      if (input.fileurl !== undefined) updateData.fileurl = input.fileurl;

      const res = await databases.updateDocument(
        this.databaseId,
        this.iulaanCollectionId,
        id,
        updateData,
      );

      return { success: true, data: res as unknown as Iulaan };
    } catch (error: any) {
      console.error("Error updating iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to update iulaan",
      };
    }
  }

  async deleteIulaan(id: string): Promise<ApiResponse<void>> {
    try {
      await databases.deleteDocument(
        this.databaseId,
        this.iulaanCollectionId,
        id,
      );
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to delete iulaan",
      };
    }
  }

  /**
   * Get recent iulaan (last 7 days)
   */
  async getRecentIulaan(): Promise<ApiResponse<Iulaan[]>> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const res = await databases.listDocuments(
        this.databaseId,
        this.iulaanCollectionId,
        [
          Query.greaterThan("$createdAt", sevenDaysAgo.toISOString()),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ],
      );

      return { success: true, data: res.documents as unknown as Iulaan[] };
    } catch (error: any) {
      console.error("Error getting recent iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to get recent iulaan",
      };
    }
  }

  /**
   * Search iulaan by multiple fields
   */
  async searchIulaan(searchTerm: string): Promise<ApiResponse<Iulaan[]>> {
    try {
      const res = await databases.listDocuments(
        this.databaseId,
        this.iulaanCollectionId,
        [
          Query.or([
            Query.search("title", searchTerm),
            Query.search("subtitle", searchTerm),
            Query.search("content", searchTerm),
          ]),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ],
      );

      return { success: true, data: res.documents as unknown as Iulaan[] };
    } catch (error: any) {
      console.error("Error searching iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to search iulaan",
      };
    }
  }
}

export const iulaanService = new IulaanService();
