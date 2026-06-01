"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { COLLECTIONS } from "@/lib/firebase/admin";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listAllDocuments,
  updateDocument,
} from "@/lib/firebase/repository";
import type {
  ApiResponse,
  PaginatedResponse,
} from "@/lib/types/database";

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

function filterByMultiFieldSearch(
  docs: Iulaan[],
  searchTerm: string,
): Iulaan[] {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return docs;
  return docs.filter(
    (d) =>
      String(d.title ?? "")
        .toLowerCase()
        .includes(q) ||
      String(d.subtitle ?? "")
        .toLowerCase()
        .includes(q) ||
      String(d.content ?? "")
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

class IulaanService {
  async createIulaan(input: CreateIulaanInput): Promise<ApiResponse<Iulaan>> {
    try {
      const data = {
        iulaannumber: input.iulaannumber,
        title: input.title,
        subtitle: input.subtitle,
        content: input.content,
        fileurl: input.fileurl ?? null,
      };

      const created = await createDocument<Iulaan>(COLLECTIONS.iulaan, data);

      return { success: true, data: created };
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
      const res = await getDocument<Iulaan>(COLLECTIONS.iulaan, id);
      return { success: true, data: res };
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
      const limit = filters?.limit ?? 10;
      const offset = filters?.offset ?? 0;

      const all = await listAllDocuments<Iulaan>(COLLECTIONS.iulaan, {
        orderBy: [{ field: "$createdAt", direction: "desc" }],
      });

      const filtered = filterByTitleSearch(all, filters?.search);
      const sorted = sortByCreatedDesc(filtered);

      return {
        success: true,
        data: paginate(sorted, limit, offset),
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
      const updateData: Record<string, unknown> = {};

      if (typeof input.iulaannumber === "string")
        updateData.iulaannumber = input.iulaannumber;
      if (typeof input.title === "string") updateData.title = input.title;
      if (typeof input.subtitle === "string")
        updateData.subtitle = input.subtitle;
      if (typeof input.content === "string") updateData.content = input.content;
      if (input.fileurl !== undefined) updateData.fileurl = input.fileurl;

      await updateDocument(COLLECTIONS.iulaan, id, updateData);

      const res = await getDocument<Iulaan>(COLLECTIONS.iulaan, id);
      return { success: true, data: res };
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
      await deleteDocument(COLLECTIONS.iulaan, id);
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to delete iulaan",
      };
    }
  }

  async getRecentIulaan(): Promise<ApiResponse<Iulaan[]>> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const all = await listAllDocuments<Iulaan>(COLLECTIONS.iulaan, {
        where: [["createdAt", ">", sevenDaysAgo]],
        orderBy: [{ field: "$createdAt", direction: "desc" }],
      });

      return { success: true, data: all.slice(0, 50) };
    } catch (error: any) {
      console.error("Error getting recent iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to get recent iulaan",
      };
    }
  }

  async searchIulaan(searchTerm: string): Promise<ApiResponse<Iulaan[]>> {
    try {
      const all = await listAllDocuments<Iulaan>(COLLECTIONS.iulaan, {
        orderBy: [{ field: "$createdAt", direction: "desc" }],
      });

      const filtered = filterByMultiFieldSearch(all, searchTerm);
      return { success: true, data: filtered.slice(0, 50) };
    } catch (error: any) {
      console.error("Error searching iulaan:", error);
      return {
        success: false,
        error: error.message || "Failed to search iulaan",
      };
    }
  }
}

const _iulaanService = new IulaanService();

export async function createIulaan(input: CreateIulaanInput) {
  return _iulaanService.createIulaan(input);
}
export async function getIulaan(id: string) {
  return _iulaanService.getIulaan(id);
}
export async function listIulaan(filters?: IulaanFilters) {
  return _iulaanService.listIulaan(filters);
}
export async function updateIulaan(id: string, input: UpdateIulaanInput) {
  return _iulaanService.updateIulaan(id, input);
}
export async function deleteIulaan(id: string) {
  return _iulaanService.deleteIulaan(id);
}
export async function getRecentIulaan() {
  return _iulaanService.getRecentIulaan();
}
export async function searchIulaan(searchTerm: string) {
  return _iulaanService.searchIulaan(searchTerm);
}

export const iulaanService = {
  createIulaan,
  getIulaan,
  listIulaan,
  updateIulaan,
  deleteIulaan,
  getRecentIulaan,
  searchIulaan,
};
