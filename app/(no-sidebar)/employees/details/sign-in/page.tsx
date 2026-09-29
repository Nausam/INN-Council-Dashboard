import AuthForm from "@/components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in to Employee Profile" };

export default function EmployeeProfileSignIn({ searchParams }: { searchParams?: { error?: string } }) {
  return <AuthForm unauthorized={searchParams?.error === "unauthorized"} forceRedirectUrl="/employees/details" employeeProfile />;
}
