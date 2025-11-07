"use client";

import { toast } from "@/hooks/use-toast";
import { createAccount, signInUser } from "@/lib/actions/user.actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type FormType = "sign-in" | "sign-up";

/* ================== Schema (Discriminated Union) ================== */

const base = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Min 8 characters"),
});

// Keep branches as plain objects (no .refine on a branch)
const signUpObj = base.extend({
  mode: z.literal("sign-up"),
  fullName: z.string().min(2, "Name is too short").max(50),
  confirmPassword: z.string().min(8, "Min 8 characters"),
});

const signInObj = base.extend({
  mode: z.literal("sign-in"),
});

// Build union first, then refine union for password match
const formSchema = z
  .discriminatedUnion("mode", [signUpObj, signInObj])
  .refine(
    (data) => data.mode === "sign-in" || data.password === data.confirmPassword,
    { message: "Passwords do not match", path: ["confirmPassword"] }
  );

type FormValues = z.infer<typeof formSchema>;

/* ================== Component ================== */

const AuthForm = ({ type }: { type: FormType }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      type === "sign-up"
        ? {
            mode: "sign-up",
            fullName: "",
            email: "",
            password: "",
            confirmPassword: "",
          }
        : {
            mode: "sign-in",
            email: "",
            password: "",
          },
  });

  // Safe helper for field error text without using `any`
  const errorOf = <K extends keyof FormValues>(name: K) => {
    const errs = form.formState.errors as Partial<
      Record<string, { message?: string }>
    >;
    return errs[name as string]?.message;
  };

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setStatus("loading");
    setErrorMessage("");

    try {
      if (values.mode === "sign-up") {
        const res = await createAccount({
          fullName: values.fullName,
          email: values.email,
          password: values.password,
        });
        if (res?.error) {
          setErrorMessage(res.error);
          setStatus("idle");
          toast({
            title: "Sign up failed",
            description: res.error,
            variant: "destructive",
          });
          return;
        }
        if (res?.ok) {
          toast({
            title: "Account created",
            description: "Welcome! You’re signed in.",
          });
          router.replace("/sign-in");
        }
      } else {
        const res = await signInUser({
          email: values.email,
          password: values.password,
        });
        if (res?.error) {
          setErrorMessage(res.error);
          setStatus("idle");
          toast({
            title: "Sign in failed",
            description: res.error,
            variant: "destructive",
          });
          return;
        }
        if (res?.ok) {
          setStatus("success");
          toast({
            title: "Signed in",
            description: "Welcome back!",
            variant: "success",
          });
          if (typeof window !== "undefined") {
            window.location.replace("/");
          }
        }
      }
    } catch {
      setStatus("idle");
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const errorMsg = (
    name: "email" | "password" | "fullName" | "confirmPassword"
  ): string | undefined => {
    const errs = form.formState.errors as {
      email?: { message?: string };
      password?: { message?: string };
      fullName?: { message?: string };
      confirmPassword?: { message?: string };
    };
    return errs[name]?.message;
  };

  return (
    <div className="flex items-center justify-center w-full max-w-xl">
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
                className="w-full px-4 py-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:border-cyan-500"
              />
              {type === "sign-up" && errorMsg("fullName") && (
                <p className="mt-2 text-sm text-red-500">
                  {errorMsg("fullName")}
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
              className="w-full px-4 py-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:border-cyan-500"
            />
            {errorOf("email") && (
              <p className="mt-2 text-sm text-red-500">{errorOf("email")}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-600 mb-2"
            >
              Password
            </label>
            <input
              {...form.register("password")}
              id="password"
              type="password"
              placeholder="Enter your password"
              className="w-full px-4 py-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:border-cyan-500"
            />
            {errorOf("password") && (
              <p className="mt-2 text-sm text-red-500">{errorOf("password")}</p>
            )}
          </div>

          {type === "sign-up" && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-600 mb-2"
              >
                Confirm Password
              </label>
              <input
                {...form.register("confirmPassword")}
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                className="w-full px-4 py-3 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:border-cyan-500"
              />
              {type === "sign-up" && errorMsg("confirmPassword") && (
                <p className="mt-2 text-sm text-red-500">
                  {errorMsg("confirmPassword")}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={status !== "idle"}
            className={`w-full h-12 rounded-full shadow-lg flex items-center justify-center
    transition-all duration-200
    ${
      status === "success"
        ? "bg-emerald-500 hover:bg-emerald-600"
        : "bg-cyan-500 hover:bg-cyan-600"
    }
    text-white disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {status === "loading" ? (
              <Image
                src="/assets/icons/loader.svg"
                alt="loading"
                width={22}
                height={22}
                className="animate-spin"
              />
            ) : status === "success" ? (
              <Check className="w-7 h-7" />
            ) : (
              <span>{type === "sign-in" ? "Sign In" : "Sign Up"}</span>
            )}
          </button>

          {errorMessage && (
            <p className="text-sm text-red-500 text-center mt-4">
              {errorMessage}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default AuthForm;
