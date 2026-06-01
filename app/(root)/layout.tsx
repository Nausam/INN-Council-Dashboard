import {
  CouncilMainFrame,
  CouncilMobileHeader,
  CouncilSidebar,
  CouncilSidebarProvider,
} from "@/components/council-sidebar";
import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CouncilSidebarProvider>
      <CouncilSidebar />
      <CouncilMainFrame>
        <CouncilMobileHeader />
        <main className="w-full flex-1">
          {children}
          <Toaster />
        </main>
      </CouncilMainFrame>
    </CouncilSidebarProvider>
  );
}
