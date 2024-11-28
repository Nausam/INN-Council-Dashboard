import Navbar from "@/components/shared/Navbar";
import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      {/* <Navbar /> */}
      <main className="flex-1">
        {children} <Toaster />
      </main>
    </div>
  );
}
