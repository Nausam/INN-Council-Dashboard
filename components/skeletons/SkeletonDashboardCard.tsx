const SkeletonDashboardCard: React.FC = () => (
  <div className="council-card animate-pulse p-6">
    <div className="mb-5 flex items-start justify-between">
      <div className="h-12 w-12 rounded-2xl bg-slate-200" />
      <div className="h-6 w-14 rounded-full bg-slate-200" />
    </div>
    <div className="mb-2 h-3 w-24 rounded bg-slate-200" />
    <div className="h-9 w-16 rounded bg-slate-200" />
  </div>
);

export default SkeletonDashboardCard;
