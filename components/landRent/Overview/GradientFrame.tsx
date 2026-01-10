"use client";

import React from "react";

export default function GradientFrame({
  outerClassName,
  innerClassName,
  washClassName,
  children,
}: {
  outerClassName: string;
  innerClassName: string;
  washClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative rounded-2xl p-[1px] ${outerClassName}`}>
      <div className={`relative overflow-hidden rounded-2xl ${innerClassName}`}>
        {washClassName ? (
          <div
            className={`pointer-events-none absolute inset-0 ${washClassName}`}
          />
        ) : null}
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
