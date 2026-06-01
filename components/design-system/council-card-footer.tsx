import { cn } from "@/lib/utils";
import { typography } from "@/lib/design-tokens";
import { ArrowRight, type LucideIcon } from "lucide-react";

type CouncilCardFooterProps = {
  label?: string;
  icon?: LucideIcon;
  className?: string;
};

export function CouncilCardFooter({
  label = "View Profile",
  icon: Icon = ArrowRight,
  className,
}: CouncilCardFooterProps) {
  return (
    <div className={cn("council-card-footer", className)}>
      <span
        className={cn(
          typography.caption,
          "transition-colors duration-200 group-hover:text-teal-600",
        )}
      >
        {label}
      </span>
      <Icon className="h-4 w-4 text-slate-400 transition-[color,transform] duration-200 group-hover:translate-x-1 group-hover:text-teal-600" />
    </div>
  );
}
