"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * Photo layered over an avatar's initial. If the image can't load, it removes
 * itself so the initial underneath shows instead of a broken image.
 */
export function AvatarPhoto({
  src,
  alt = "",
  className,
  loading = "lazy",
}: {
  src: string;
  alt?: string;
  className?: string;
  /** "eager" for a photo that is on screen as soon as the page opens. */
  loading?: "lazy" | "eager";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- auth-gated redirect URL, not optimisable
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
    />
  );
}
