import { cn } from "@/lib/utils";
import { typography } from "@/lib/design-tokens";
import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-12", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="council-page-icon">
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <h1 className={typography.pageTitle}>{title}</h1>
            {subtitle && (
              <p className={typography.pageSubtitle}>{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
