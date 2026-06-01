import React from "react";

const SkeletonProgressBar: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-200" />
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-3 w-32 rounded bg-slate-200" />
        </div>
      </div>
      <div className="h-8 w-12 rounded-xl bg-slate-200" />
    </div>
    <div className="h-2.5 rounded-full bg-slate-200" />
  </div>
);

const SkeletonProgressSection: React.FC = () => {
  return (
    <div className="council-card animate-pulse p-6 lg:p-8">
      <div className="mb-8 border-b border-slate-200/80 pb-6">
        <div className="h-6 w-48 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-64 rounded bg-slate-200" />
      </div>
      <div className="space-y-8">
        <SkeletonProgressBar />
        <SkeletonProgressBar />
        <SkeletonProgressBar />
      </div>
    </div>
  );
};

export default SkeletonProgressSection;
