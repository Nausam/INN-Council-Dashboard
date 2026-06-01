import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { getSectionBadgeStyle } from "@/lib/design-tokens";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        section: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  section?: string;
}

function Badge({ className, variant, section, children, ...props }: BadgeProps) {
  const sectionStyle =
    variant === "section" ? getSectionBadgeStyle(section ?? String(children)) : null;

  return (
    <div
      className={cn(
        badgeVariants({ variant }),
        sectionStyle && [
          "rounded-xl border-0 px-3 py-1.5 ring-1 ring-black/5",
          sectionStyle.bg,
          sectionStyle.text,
        ],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
