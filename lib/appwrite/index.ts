"use server";

import { appwriteConfig } from "@/lib/appwrite/config";
import { cookies } from "next/headers";
import {
  Account,
  Avatars,
  Client,
  Databases,
  Storage,
  Users,
} from "node-appwrite";

export const createSessionClient = async () => {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpointUrl)
    .setProject(appwriteConfig.projectId);

  const sessionCookie = cookies().get("appwrite-session");
  if (!sessionCookie || !sessionCookie.value) throw new Error("No session");

  // Authenticate this client with the session secret stored in the cookie
  client.setSession(sessionCookie.value);

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
  };
};

export const createAdminClient = async () => {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpointUrl)
    .setProject(appwriteConfig.projectId)
    .setKey(appwriteConfig.secretKey);

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
    get storage() {
      return new Storage(client);
    },
    get avatars() {
      return new Avatars(client);
    },
    // 👇 needed for creating auth users with email+password
    get users() {
      return new Users(client);
    },
  };
};
