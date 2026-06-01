"use server";

import { COLLECTIONS } from "@/lib/firebase/admin";
import { createDocument, newDocId } from "@/lib/firebase/repository";
import { uploadToR2 } from "@/lib/r2";
import { parseStringify } from "@/lib/utils";

type CreateRegistrationParams = {
  fullName: string;
  address: string;
  contactNumber: number;
  idCard: string;
  isCitizen: boolean;
  isCompany: boolean;
  isRetailer: boolean;
};

export const createRegistration = async (params: CreateRegistrationParams) => {
  try {
    const registration = await createDocument(
      COLLECTIONS.wasteManagementForms,
      params as Record<string, unknown>,
    );
    return parseStringify(registration);
  } catch (error) {
    console.error("Failed to create registration:", error);
    throw new Error("Failed to create registration");
  }
};

export const uploadImage = async (file: File): Promise<string> => {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const objectKey = `waste/${newDocId()}/${file.name}`;
    await uploadToR2(objectKey, buffer, file.type || "application/octet-stream");
    return `/api/files/r2?key=${encodeURIComponent(objectKey)}&mode=view`;
  } catch (error) {
    console.error("Failed to upload image:", error);
    throw new Error("Failed to upload image");
  }
};
