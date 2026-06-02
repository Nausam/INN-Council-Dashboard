"use client";

import { SignIn } from "@clerk/nextjs";
import {
  BarChart3,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import Image from "next/image";

import { councilClerkAppearance } from "@/lib/clerk-appearance";

const modules = [
  { icon: Clock3, label: "Attendance" },
  { icon: Users, label: "Employees" },
  { icon: BarChart3, label: "Reports" },
];

function AuthWave() {
  return (
    <svg
      viewBox="0 0 440 56"
      preserveAspectRatio="none"
      className="absolute bottom-0 left-0 h-14 w-full"
      aria-hidden
    >
      <path
        fill="#ffffff"
        d="M0,28 C73,44 147,12 220,28 C293,44 367,12 440,28 L440,56 L0,56 Z"
      />
    </svg>
  );
}

const AuthForm = ({ unauthorized = false }: { unauthorized?: boolean }) => {
  return (
    <div className="w-full">
      <div className="rounded-[1.75rem] bg-white shadow-[0_24px_60px_-12px_rgba(13,148,136,0.18)] ring-1 ring-teal-900/5">
        <header className="relative overflow-hidden rounded-t-[1.75rem] bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 px-8 pb-16 pt-9 text-center text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl" />

          <div className="relative mx-auto mb-5 flex h-[88px] w-[88px] items-center justify-center rounded-[1.25rem] bg-white p-3 shadow-lg shadow-teal-950/25">
            <Image
              src="/assets/icons/logo.png"
              alt="Innamaadhoo Council"
              width={64}
              height={64}
              className="object-contain"
              priority
            />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-100/90">
            Innamaadhoo Council
          </p>
          <h1 className="mt-2 text-[1.65rem] font-bold tracking-tight">
            HR Dashboard
          </h1>
          <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-teal-50/85">
            Staff portal for attendance, payroll, and council services
          </p>

          <div className="mx-auto mt-6 flex max-w-[320px] justify-center gap-2">
            {modules.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-teal-50 backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                {label}
              </span>
            ))}
          </div>

          <AuthWave />
        </header>

        <div className="relative -mt-1 overflow-visible rounded-b-[1.75rem] px-8 pb-8 pt-2">
          <div className="mb-7 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Use your council email to access the dashboard.
            </p>
          </div>

          {unauthorized ? (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              This email is not authorized to access the dashboard. Contact the
              council administrator if you need access.
            </div>
          ) : null}

          <div className="clerk-auth-root">
            <SignIn routing="hash" appearance={councilClerkAppearance} />
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                Secure access
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole className="h-3.5 w-3.5 text-teal-600" />
                Staff only
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
