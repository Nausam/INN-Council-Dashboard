const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-10 sm:py-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.18), transparent 50%),
            radial-gradient(circle at 100% 100%, rgba(6, 182, 212, 0.12), transparent 40%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(13,148,136,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(13,148,136,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 w-full max-w-[440px]">{children}</div>
    </div>
  );
};

export default layout;
