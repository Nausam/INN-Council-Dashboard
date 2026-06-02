"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

type EmployeeModalShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  header?: React.ReactNode;
  size?: "md" | "lg" | "xl";
};

const sizeClasses = {
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function EmployeeModalShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  header,
  size = "lg",
}: EmployeeModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        disableDefaultAnimation
        overlayClassName={cn(
          "employee-modal-overlay bg-slate-900/45 backdrop-blur-md",
        )}
        className={cn(
          "employee-modal-content flex max-h-[92vh] w-[calc(100%-2rem)] max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-0 shadow-2xl shadow-slate-900/10",
          sizeClasses[size],
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        ) : null}

        <div className="relative shrink-0 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 px-6 py-5">
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl",
              "border border-slate-200/80 bg-white text-slate-500 shadow-sm",
              "transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800",
              "focus:outline-none focus:ring-4 focus:ring-indigo-100",
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {header ?? (
            <div className="pr-12">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm font-medium text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
