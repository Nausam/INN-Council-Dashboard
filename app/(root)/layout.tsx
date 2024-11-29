import Navbar from "@/components/shared/Navbar";
import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* <Navbar /> */}
      <main>
        {children} <Toaster />
      </main>
    </div>
  );
}
