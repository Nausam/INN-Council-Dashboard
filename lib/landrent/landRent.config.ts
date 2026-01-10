import { Client, Databases } from "node-appwrite";

export const appwriteConfig = {
  endpoint: process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  projectId: process.env.APPWRITE_PROJECT || "",
  databaseId: process.env.APPWRITE_DATABASE_ID || "",

  landParcelsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION ?? "",
  landTenantsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION ?? "",
  landLeasesCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION ?? "",

  landStatementsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_STATEMENTS_COLLECTION ?? "",
  landPaymentsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_PAYMENTS_COLLECTION ?? "",
};

export function adminDb() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setKey(process.env.APPWRITE_API_KEY ?? "");

  return new Databases(client);
}
