"use server";

import { cookies } from "next/headers";
import { ID, Query } from "node-appwrite";

import { createAdminClient, createSessionClient } from "@/lib/appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import { parseStringify } from "@/lib/utils";

/* ---------- helpers ---------- */

const getUserDocByEmail = async (email: string) => {
  const { databases } = await createAdminClient();

  const result = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.usersCollectionId,
    [Query.equal("email", [email])]
  );

  return result.total > 0 ? result.documents[0] : null;
};

/* ---------- actions ---------- */

export const createAccount = async ({
  fullName,
  email,
  password,
}: {
  fullName: string;
  email: string;
  password: string;
}) => {
  try {
    const { users, account, databases } = await createAdminClient();

    // 1) Create auth user (Users API)
    const created = await users.create(
      ID.unique(),
      email,
      undefined, // phone
      password,
      fullName
    );

    // 2) Create session for the new user
    const session = await account.createEmailPasswordSession(email, password);

    // 3) Store session secret in cookie
    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    // 4) Ensure a profile document in your Users collection
    const existingDoc = await getUserDocByEmail(email);
    if (!existingDoc) {
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.usersCollectionId,
        ID.unique(),
        {
          fullName,
          email,
          accountId: created.$id,
        }
      );
    }

    return parseStringify({ ok: true, accountId: created.$id });
  } catch {
    return parseStringify({
      error:
        "Could not create account. If you already registered, please sign in instead.",
    });
  }
};

export const signInUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  try {
    const { account } = await createAdminClient();

    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return parseStringify({ ok: true, sessionId: session.$id });
  } catch {
    return parseStringify({ error: "Invalid email or password." });
  }
};

export const getCurrentUser = async () => {
  try {
    const { databases, account } = await createSessionClient();

    const me = await account.get();
    const userList = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal("accountId", [me.$id])]
    );

    if (userList.total <= 0) return null;

    return parseStringify(userList.documents[0]);
  } catch {
    return null;
  }
};

export const signOutUser = async () => {
  try {
    const { account } = await createSessionClient();
    await account.deleteSession("current");
  } finally {
    cookies().delete("appwrite-session");
  }
};
