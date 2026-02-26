import { Toaster } from "@/components/ui/toaster";

export default function NoSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen w-full">
      {children}
      <Toaster />
    </main>
  );
}
