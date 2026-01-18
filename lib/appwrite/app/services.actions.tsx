/* eslint-disable @typescript-eslint/no-explicit-any */
import { Query } from "appwrite";
import type {
  ApiResponse,
  PaginatedResponse,
} from "../../../lib/types/database";
import { APPWRITE_CONFIG, databases, ID } from "../app/appwrite";

/* ============================== Types ============================== */

export type DirectoryKind = "service" | "competition";

export type DirectoryItem = {
  $id: string;

  // "service" | "competition"
  kind: DirectoryKind;

  // Dhivehi only
  title: string;
  description: string;

  // optional (if you want category later)
  category?: string | null;

  // optional publish flag so you can draft in web app
  published?: boolean;

  $createdAt: string;
  $updatedAt: string;
};

export type CreateDirectoryItemInput = {
  kind: DirectoryKind;
  title: string;
  description: string;
  category?: string | null;
  published?: boolean;
};

export type UpdateDirectoryItemInput = Partial<CreateDirectoryItemInput>;

export type DirectoryItemFilters = {
  search?: string;
  kind?: DirectoryKind;
  category?: string;
  publishedOnly?: boolean; // default true
  limit?: number;
  offset?: number;
};

/* ============================== Service ============================== */

class ServicesCompetitionsService {
  private databaseId = APPWRITE_CONFIG.databaseId;

  /**
   * ✅ Add this to APPWRITE_CONFIG (and env):
   * servicesCompetitionsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_SERVICES_COMPETITIONS_COLLECTION ?? ""
   */
  private collectionId = (APPWRITE_CONFIG as any)
    .servicesCompetitionsCollectionId;

  private assertConfig() {
    if (!this.collectionId)
      throw new Error(
        "Missing APPWRITE_CONFIG.servicesCompetitionsCollectionId (add it to your config + env)",
      );
  }

  async createItem(
    input: CreateDirectoryItemInput,
  ): Promise<ApiResponse<DirectoryItem>> {
    try {
      this.assertConfig();

      const data: any = {
        kind: input.kind,
        title: input.title,
        description: input.description,
        category: input.category ?? null,
        published: input.published ?? true,
      };

      const created = await databases.createDocument(
        this.databaseId,
        this.collectionId,
        ID.unique(),
        data,
      );

      return { success: true, data: created as unknown as DirectoryItem };
    } catch (error: any) {
      console.error("Error creating item:", error);
      return {
        success: false,
        error: error.message || "Failed to create item",
      };
    }
  }

  async getItem(id: string): Promise<ApiResponse<DirectoryItem>> {
    try {
      this.assertConfig();

      const res = await databases.getDocument(
        this.databaseId,
        this.collectionId,
        id,
      );
      return { success: true, data: res as unknown as DirectoryItem };
    } catch (error: any) {
      console.error("Error getting item:", error);
      return {
        success: false,
        error: error.message || "Failed to get item",
      };
    }
  }

  async listItems(
    filters?: DirectoryItemFilters,
  ): Promise<ApiResponse<PaginatedResponse<DirectoryItem>>> {
    try {
      this.assertConfig();

      const queries: string[] = [];

      const publishedOnly = filters?.publishedOnly ?? true;
      if (publishedOnly) queries.push(Query.equal("published", true));

      if (filters?.kind) queries.push(Query.equal("kind", filters.kind));
      if (filters?.category)
        queries.push(Query.equal("category", filters.category));

      if (filters?.search) {
        const s = filters.search.trim();
        if (s) {
          queries.push(
            Query.or([
              Query.search("title", s),
              Query.search("description", s),
            ]),
          );
        }
      }

      queries.push(Query.orderDesc("$createdAt"));

      const limit = filters?.limit ?? 30;
      const offset = filters?.offset ?? 0;
      queries.push(Query.limit(limit));
      queries.push(Query.offset(offset));

      const res = await databases.listDocuments(
        this.databaseId,
        this.collectionId,
        queries,
      );

      return {
        success: true,
        data: {
          documents: res.documents as unknown as DirectoryItem[],
          total: res.total,
          limit,
          offset,
        },
      };
    } catch (error: any) {
      console.error("Error listing items:", error);
      return {
        success: false,
        error: error.message || "Failed to list items",
      };
    }
  }

  async updateItem(
    id: string,
    input: UpdateDirectoryItemInput,
  ): Promise<ApiResponse<DirectoryItem>> {
    try {
      this.assertConfig();

      const updateData: any = {};

      if (typeof input.kind === "string") updateData.kind = input.kind;
      if (typeof input.title === "string") updateData.title = input.title;
      if (typeof input.description === "string")
        updateData.description = input.description;

      if (input.category !== undefined)
        updateData.category = input.category ?? null;
      if (input.published !== undefined)
        updateData.published = !!input.published;

      const res = await databases.updateDocument(
        this.databaseId,
        this.collectionId,
        id,
        updateData,
      );

      return { success: true, data: res as unknown as DirectoryItem };
    } catch (error: any) {
      console.error("Error updating item:", error);
      return {
        success: false,
        error: error.message || "Failed to update item",
      };
    }
  }

  async deleteItem(id: string): Promise<ApiResponse<void>> {
    try {
      this.assertConfig();

      await databases.deleteDocument(this.databaseId, this.collectionId, id);
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting item:", error);
      return {
        success: false,
        error: error.message || "Failed to delete item",
      };
    }
  }

  async searchItems(searchTerm: string): Promise<ApiResponse<DirectoryItem[]>> {
    try {
      this.assertConfig();

      const s = (searchTerm ?? "").trim();
      if (!s) return { success: true, data: [] };

      const res = await databases.listDocuments(
        this.databaseId,
        this.collectionId,
        [
          Query.equal("published", true),
          Query.or([Query.search("title", s), Query.search("description", s)]),
          Query.orderDesc("$createdAt"),
          Query.limit(50),
        ],
      );

      return {
        success: true,
        data: res.documents as unknown as DirectoryItem[],
      };
    } catch (error: any) {
      console.error("Error searching items:", error);
      return {
        success: false,
        error: error.message || "Failed to search items",
      };
    }
  }
}

export const servicesCompetitionsService = new ServicesCompetitionsService();
