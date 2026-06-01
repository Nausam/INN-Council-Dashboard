import AuthForm from "@/components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | Innamaadhoo Council",
  description: "Sign in to the Council HR Dashboard",
};

const SignIn = () => <AuthForm type="sign-in" />;

export default SignIn;
