/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
    outputFileTracingIncludes: {
      // match your API route file path precisely
      "app/api/innamaadhoo/route.ts": ["./data/salat.db"],
    },
  },
};

export default nextConfig;
