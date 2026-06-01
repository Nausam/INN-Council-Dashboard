import { cn } from "@/lib/utils";
import { getSectionBadgeStyle } from "@/lib/design-tokens";
import { Briefcase, type LucideIcon } from "lucide-react";

type SectionBadgeProps = {
  section: string;
  icon?: LucideIcon;
  className?: string;
};

export function SectionBadge({
  section,
  icon: Icon = Briefcase,
  className,
}: SectionBadgeProps) {
  const style = getSectionBadgeStyle(section);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 shadow-sm ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-[1.02]",
        style.bg,
        className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", style.icon)} />
      <span className={cn("text-xs font-bold", style.text)}>{section}</span>
    </div>
  );
}
