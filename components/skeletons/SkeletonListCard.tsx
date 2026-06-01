import React from "react";

const SkeletonListCard: React.FC = () => {
  return (
    <div className="council-card animate-pulse overflow-hidden p-0">
      <div className="border-b border-slate-200/80 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-slate-200" />
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-200" />
          </div>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-200" />
          <div className="h-4 flex-1 rounded bg-slate-200" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-200" />
          <div className="h-4 flex-1 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
};

export default SkeletonListCard;
