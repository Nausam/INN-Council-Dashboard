import { QueryProvider } from "@/Providers/QueryProvider";
import { UserProvider } from "@/Providers/UserProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { PwaRegister } from "@/components/PwaRegister";
import type { Metadata, Viewport } from "next";
import "./globals.css";

import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: { default: "Council HR", template: "%s · Council HR" },
  description: "Innamaadhoo Council employee attendance, leave, and pay.",
  applicationName: "Innamaadhoo Council HR",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Council HR" },
  icons: {
    icon: [{ url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakarta.className} ${plusJakarta.variable}`}>
        <PwaRegister />
        <ClerkProvider>
          <QueryProvider>
            <UserProvider>
              <main>{children}</main>
            </UserProvider>
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
