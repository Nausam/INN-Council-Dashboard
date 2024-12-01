"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createAccount, signInUser } from "@/lib/actions/user.actions";
import OtpModal from "@/components/OTPModal";

type FormType = "sign-in" | "sign-up";

const authFormSchema = (formType: FormType) => {
  return z.object({
    email: z.string().email(),
    fullName:
      formType === "sign-up"
        ? z.string().min(2).max(50)
        : z.string().optional(),
  });
};

const AuthForm = ({ type }: { type: FormType }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [accountId, setAccountId] = useState(null);

  const formSchema = authFormSchema(type);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const user =
        type === "sign-up"
          ? await createAccount({
              fullName: values.fullName || "",
              email: values.email,
            })
          : await signInUser({ email: values.email });

      setAccountId(user.accountId);
    } catch {
      setErrorMessage("Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-full max-w-2xl">
      <div className="bg-white shadow-lg rounded-2xl px-8 py-10 w-full">
        <h1 className="text-3xl font-semibold text-gray-800 text-center mb-8">
          {type === "sign-in" ? "Sign In" : "Sign Up"}
        </h1>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {type === "sign-up" && (
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-600 mb-2"
              >
                Full Name
              </label>
              <input
                {...form.register("fullName")}
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                className="w-full px-4 py-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-0 focus:ring-cyan-500 focus:border-cyan-500"
              />
              {form.formState.errors.fullName && (
                <p className="mt-2 text-sm text-red-500">
                  {form.formState.errors.fullName.message}
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-600 mb-2"
            >
              Email
            </label>
            <input
              {...form.register("email")}
              id="email"
              type="email"
              placeholder="Enter your email"
              className="w-full px-4 py-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:ring-0 focus:ring-cyan-500 focus:border-cyan-500"
            />
            {form.formState.errors.email && (
              <p className="mt-2 text-sm text-red-500">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-3 text-white font-medium bg-cyan-500 rounded-full shadow-lg hover:bg-cyan-600 focus:outline-none focus:ring-0 focus:ring-cyan-500 flex items-center justify-center"
          >
            <span>{type === "sign-in" ? "Sign In" : "Sign Up"}</span>
            {isLoading && (
              <Image
                src="/assets/icons/loader.svg"
                alt="loader"
                width={24}
                height={24}
                className="ml-2 animate-spin"
              />
            )}
          </button>

          {errorMessage && (
            <p className="text-sm text-red-500 text-center mt-4">
              {errorMessage}
            </p>
          )}

          {/* <div className="text-center text-sm text-gray-600 mt-4">
            {type === "sign-in"
              ? "Don't have an account?"
              : "Already have an account?"}
            <Link
              href={type === "sign-in" ? "/sign-up" : "/sign-in"}
              className="ml-1 font-medium text-cyan-500 hover:underline"
            >
              {type === "sign-in" ? "Sign Up" : "Sign In"}
            </Link>
          </div> */}
        </form>
      </div>

      {accountId && (
        <OtpModal email={form.getValues("email")} accountId={accountId} />
      )}
    </div>
  );
};

export default AuthForm;
