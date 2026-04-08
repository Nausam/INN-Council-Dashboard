export const appwriteConfig = {
  endpointUrl: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE!,
  usersCollectionId: process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION!,
  wasteManagementFormsId:
    process.env.NEXT_PUBLIC_APPWRITE_WASTE_MANAGEMENT_COLLECTION!,
  secretKey: process.env.NEXT_APPWRITE_KEY!,
  bucketId: process.env.NEXT_PUBLIC_APPWRITE_BUCKET!,
  /** Document receiver registry — Appwrite collection id (create in console). */
  correspondenceCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_CORRESPONDENCE_COLLECTION ?? "",
  /** Unused for correspondence files (those use Cloudflare R2). Kept for older configs. */
  correspondenceBucketId:
    process.env.NEXT_PUBLIC_APPWRITE_CORRESPONDENCE_BUCKET ??
    process.env.NEXT_PUBLIC_APPWRITE_BUCKET ??
    "",
};
