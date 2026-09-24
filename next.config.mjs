/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/correspondence",
        destination: "/document-reciever",
        permanent: true,
      },
      {
        source: "/correspondence/:path*",
        destination: "/document-reciever/:path*",
        permanent: true,
      },
      {
        source: "/api/correspondence/:path*",
        destination: "/api/document-reciever/:path*",
        permanent: true,
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "@heroicons/react",
      "react-icons",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
    ],
    serverActions: {
      bodySizeLimit: "16mb",
    },
    serverComponentsExternalPackages: ["better-sqlite3", "node-zklib"],
    outputFileTracingIncludes: {
      "/*": ["./assets/forms/salaam-family-leave-template.docx"],
      // match your API route file path precisely
      "app/api/innamaadhoo/route.ts": ["./data/salat.db"],
    },
  },
};

export default nextConfig;
