import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SidebarProvider>
        <AppSidebar />
        <SidebarTrigger />
        <main className="w-full">
          {children} <Toaster />
        </main>
      </SidebarProvider>
    </div>
  );
}
