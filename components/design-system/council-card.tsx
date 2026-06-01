"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const councilCardVariants = cva("council-card group", {
  variants: {
    interactive: {
      none: "",
      hover: "council-card-interactive",
      full: "council-card-interactive",
    },
  },
  defaultVariants: {
    interactive: "hover",
  },
});

export type CouncilCardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof councilCardVariants> & {
    asChild?: boolean;
  };

export function CouncilCard({
  className,
  interactive,
  children,
  onClick,
  ...props
}: CouncilCardProps) {
  const isInteractive = interactive !== "none" || !!onClick;

  return (
    <div
      className={cn(
        councilCardVariants({
          interactive: onClick || isInteractive ? interactive ?? "hover" : "none",
        }),
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      {...props}
    >
      {children}
    </div>
  );
}
