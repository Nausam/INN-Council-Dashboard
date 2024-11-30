"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Account, Client } from "appwrite";
import { appwriteConfig } from "@/lib/appwrite/appwrite";
import { useRouter } from "next/navigation";

const AuthContext = createContext<any>(null);

const { endpoint, projectId } = appwriteConfig;

// Initialize Appwrite Client
const client = new Client();
client.setEndpoint(endpoint).setProject(projectId);

const account = new Account(client);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  // Check if user is authenticated
  const fetchUser = async () => {
    setLoading(true);
    try {
      const user = await account.get();
      setUser(user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await account.createEmailPasswordSession(email, password);
      await fetchUser();
      router.push("/"); // Redirect to home page
    } catch (error) {
      console.error("Error logging in:", error);
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await account.deleteSession("current");
      setUser(null);
      router.push("/auth/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {loading ? <p>Loading...</p> : children}
    </AuthContext.Provider>
  );
};

// Hook to use AuthContext
export const useAuth = () => useContext(AuthContext);
