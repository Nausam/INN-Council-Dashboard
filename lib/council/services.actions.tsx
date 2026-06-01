"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { COLLECTIONS } from "@/lib/firebase/admin";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listAllDocuments,
  updateDocument,
  type WhereClause,
} from "@/lib/firebase/repository";
import type {
  ApiResponse,
  PaginatedResponse,
} from "@/lib/types/database";

/* ============================== Types ============================== */

export type DirectoryKind = "service" | "competition";

export type DirectoryItem = {
  $id: string;

  kind: DirectoryKind;

  title: string;
  description: string;

  category?: string | null;

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
  publishedOnly?: boolean;
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

function filterBySearch(
  docs: DirectoryItem[],
  search?: string,
): DirectoryItem[] {
  const q = search?.trim().toLowerCase();
  if (!q) return docs;
  return docs.filter(
    (d) =>
      String(d.title ?? "")
        .toLowerCase()
        .includes(q) ||
      String(d.description ?? "")
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

function buildListWhere(filters?: DirectoryItemFilters): WhereClause[] {
  const where: WhereClause[] = [];
  const publishedOnly = filters?.publishedOnly ?? true;
  if (publishedOnly) where.push(["published", "==", true]);
  if (filters?.kind) where.push(["kind", "==", filters.kind]);
  if (filters?.category) where.push(["category", "==", filters.category]);
  return where;
}

/* ============================== Service ============================== */

class ServicesCompetitionsService {
  async createItem(
    input: CreateDirectoryItemInput,
  ): Promise<ApiResponse<DirectoryItem>> {
    try {
      const data = {
        kind: input.kind,
        title: input.title,
        description: input.description,
        category: input.category ?? null,
        published: input.published ?? true,
      };

      const created = await createDocument<DirectoryItem>(
        COLLECTIONS.servicesCompetitions,
        data,
      );

      return { success: true, data: created };
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
      const res = await getDocument<DirectoryItem>(
        COLLECTIONS.servicesCompetitions,
        id,
      );
      return { success: true, data: res };
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
      const limit = filters?.limit ?? 30;
      const offset = filters?.offset ?? 0;

      const all = await listAllDocuments<DirectoryItem>(
        COLLECTIONS.servicesCompetitions,
        {
          where: buildListWhere(filters),
          orderBy: [{ field: "$createdAt", direction: "desc" }],
        },
      );

      const filtered = filterBySearch(all, filters?.search);
      const sorted = sortByCreatedDesc(filtered);

      return {
        success: true,
        data: paginate(sorted, limit, offset),
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
      const updateData: Record<string, unknown> = {};

      if (typeof input.kind === "string") updateData.kind = input.kind;
      if (typeof input.title === "string") updateData.title = input.title;
      if (typeof input.description === "string")
        updateData.description = input.description;

      if (input.category !== undefined)
        updateData.category = input.category ?? null;
      if (input.published !== undefined)
        updateData.published = !!input.published;

      await updateDocument(COLLECTIONS.servicesCompetitions, id, updateData);

      const res = await getDocument<DirectoryItem>(
        COLLECTIONS.servicesCompetitions,
        id,
      );

      return { success: true, data: res };
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
      await deleteDocument(COLLECTIONS.servicesCompetitions, id);
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
      const s = (searchTerm ?? "").trim();
      if (!s) return { success: true, data: [] };

      const all = await listAllDocuments<DirectoryItem>(
        COLLECTIONS.servicesCompetitions,
        {
          where: [["published", "==", true]],
          orderBy: [{ field: "$createdAt", direction: "desc" }],
        },
      );

      const filtered = filterBySearch(all, s);
      return {
        success: true,
        data: filtered.slice(0, 50),
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

const _servicesCompetitionsService = new ServicesCompetitionsService();

export async function createDirectoryItem(input: CreateDirectoryItemInput) {
  return _servicesCompetitionsService.createItem(input);
}
export async function getDirectoryItem(id: string) {
  return _servicesCompetitionsService.getItem(id);
}
export async function listDirectoryItems(filters?: DirectoryItemFilters) {
  return _servicesCompetitionsService.listItems(filters);
}
export async function updateDirectoryItem(
  id: string,
  input: UpdateDirectoryItemInput,
) {
  return _servicesCompetitionsService.updateItem(id, input);
}
export async function deleteDirectoryItem(id: string) {
  return _servicesCompetitionsService.deleteItem(id);
}
export async function searchDirectoryItems(searchTerm: string) {
  return _servicesCompetitionsService.searchItems(searchTerm);
}

export const servicesCompetitionsService = {
  createItem: createDirectoryItem,
  getItem: getDirectoryItem,
  listItems: listDirectoryItems,
  updateItem: updateDirectoryItem,
  deleteItem: deleteDirectoryItem,
  searchItems: searchDirectoryItems,
};
