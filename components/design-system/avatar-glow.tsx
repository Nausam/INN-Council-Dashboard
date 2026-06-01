import { cn } from "@/lib/utils";
import { getAvatarAccent, shadows } from "@/lib/design-tokens";

type AvatarGlowProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-10 w-10 rounded-xl text-base",
  md: "h-14 w-14 rounded-2xl text-lg",
  lg: "h-16 w-16 rounded-2xl text-xl",
};

export function AvatarGlow({ name, size = "md", className }: AvatarGlowProps) {
  const accent = getAvatarAccent(name);
  const initial = name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center font-black text-white transition-transform duration-200 group-hover:scale-105",
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(to bottom right, ${accent.from}, ${accent.to})`,
        boxShadow: shadows.avatar(accent.glow),
      }}
    >
      {initial}
    </div>
  );
}
