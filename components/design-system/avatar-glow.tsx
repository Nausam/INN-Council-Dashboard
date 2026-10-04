import { cn } from "@/lib/utils";
import { getAvatarAccent, shadows } from "@/lib/design-tokens";
import { AvatarPhoto } from "./avatar-photo";

type AvatarGlowProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Profile photo URL; the initial shows when it's missing or fails to load. */
  src?: string;
};

const sizeClasses = {
  sm: "h-10 w-10 rounded-xl text-base",
  md: "h-14 w-14 rounded-2xl text-lg",
  lg: "h-16 w-16 rounded-2xl text-xl",
};

export function AvatarGlow({ name, size = "md", className, src }: AvatarGlowProps) {
  const accent = getAvatarAccent(name);
  const initial = name?.charAt(0)?.toUpperCase() || "?";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-black text-white transition-transform duration-200 group-hover:scale-105",
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(to bottom right, ${accent.from}, ${accent.to})`,
        boxShadow: shadows.avatar(accent.glow),
      }}
    >
      {initial}
      {src ? <AvatarPhoto src={src} alt={name} /> : null}
    </div>
  );
}
