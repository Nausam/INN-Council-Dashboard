"use client";

import { CouncilCard } from "@/components/design-system";
import React from "react";

const SkeletonEmployeeDetailsCard = () => {
  return (
    <div className="animate-pulse space-y-6">
      <CouncilCard interactive="none" className="overflow-hidden p-0">
        <div className="h-24 bg-slate-200" />
        <div className="px-6 pb-6 pt-0 sm:px-8 sm:pb-8">
          <div className="-mt-12 mb-5 h-24 w-24 rounded-2xl bg-slate-200" />
          <div className="space-y-3">
            <div className="h-10 w-2/3 rounded bg-slate-200" />
            <div className="h-10 w-48 rounded-xl bg-slate-200" />
            <div className="h-16 w-56 rounded-xl bg-slate-200" />
          </div>
        </div>
      </CouncilCard>

      <CouncilCard interactive="none" className="p-0">
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-5 w-40 rounded bg-slate-200" />
              <div className="h-4 w-56 rounded bg-slate-200" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="h-40 rounded-2xl bg-slate-100 ring-1 ring-slate-200/80"
            />
          ))}
        </div>
      </CouncilCard>
    </div>
  );
};

export default SkeletonEmployeeDetailsCard;
