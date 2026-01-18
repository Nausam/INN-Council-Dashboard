import { Account, Client, Databases, ID, Storage } from "appwrite";

// Appwrite Configuration
const APPWRITE_CONFIG = {
  endpoint:
    process.env.NEXT_PUBLIC_APP_APPWRITE_ENDPOINT ||
    "https://fra.cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APP_APPWRITE_PROJECT_ID || "",
  databaseId: process.env.NEXT_PUBLIC_APP_APPWRITE_DATABASE_ID || "",
  // Collections
  postsCollectionId:
    process.env.NEXT_PUBLIC_APP_APPWRITE_POSTS_COLLECTION_ID || "",
  publicationsCollectionId:
    process.env.NEXT_PUBLIC_APP_APPWRITE_PUBLICATIONS_COLLECTION_ID || "",
  // Storage
  storageId: process.env.NEXT_PUBLIC_APP_APPWRITE_STORAGE_ID || "",
  ninmunVotesCollectionId:
    process.env.NEXT_PUBLIC_APP_APPWRITE_NINMUN_VOTES_COLLECTION || "",
  councilNinmunCollectionId:
    process.env.NEXT_PUBLIC_APP_APPWRITE_COUNCIL_NINMUN_COLLECTION || "",
  iulaanCollectionId:
    process.env.NEXT_PUBLIC_APP_APPWRITE_COUNCIL_IULAAN_COLLECTION || "",
};

// Initialize Appwrite Client
const client = new Client();

client
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId);

// Initialize Services
export const databases = new Databases(client);
export const storage = new Storage(client);
export const account = new Account(client);

// Export config for use in other files
export { APPWRITE_CONFIG, ID };

// Export client for custom configurations
export default client;

console.log(APPWRITE_CONFIG);
