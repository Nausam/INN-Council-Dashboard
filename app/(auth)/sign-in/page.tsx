import AuthForm from "@/components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | Innamaadhoo Council",
  description: "Sign in to the Council HR Dashboard",
};

type SignInPageProps = {
  searchParams: { error?: string };
};

const SignInPage = ({ searchParams }: SignInPageProps) => (
  <AuthForm unauthorized={searchParams.error === "unauthorized"} />
);

export default SignInPage;
