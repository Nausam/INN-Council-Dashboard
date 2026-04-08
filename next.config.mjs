/** @type {import('next').NextConfig} */
const nextConfig = {
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
    serverComponentsExternalPackages: ["better-sqlite3"],
    outputFileTracingIncludes: {
      // match your API route file path precisely
      "app/api/innamaadhoo/route.ts": ["./data/salat.db"],
    },
  },
};

export default nextConfig;
