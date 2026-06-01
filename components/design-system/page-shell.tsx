import { cn } from "@/lib/utils";
import { pageBackground } from "@/lib/design-tokens";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "default" | "full";
};

export function PageShell({
  children,
  className,
  maxWidth = "default",
}: PageShellProps) {
  return (
    <div className={cn(pageBackground, className)}>
      <div
        className={cn(
          "mx-auto px-4 py-8 lg:px-8",
          maxWidth === "default" ? "max-w-7xl" : "w-full",
        )}
      >
        {children}
      </div>
    </div>
  );
}
