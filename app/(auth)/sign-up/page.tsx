import AuthForm from "@/components/AuthForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account | Innamaadhoo Council",
  description: "Create an account for the Council HR Dashboard",
};

const SignUp = () => <AuthForm type="sign-up" />;

export default SignUp;
