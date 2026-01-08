import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: "standalone",
  // Transpile workspace packages
  transpilePackages: ["@vcecom/cms-blocks"],
  // Note: Rewrites removed - all API requests now go through Next.js API routes
  // /api/proxy/* -> handled by Next.js API route at app/api/proxy/[...path]/route.ts
  // /api/auth/* -> handled by Next.js API routes at app/api/auth/*/route.ts
  // This ensures proper cookie handling and centralized auth refresh
  images: {
    remotePatterns: [
      // MinIO (local development) - explicit port 9000
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
      // Allow any localhost with any port (for development)
      // This pattern should match localhost with any port
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/**",
      },
      // AWS S3
      {
        protocol: "https",
        hostname: "**.s3.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.s3.**.amazonaws.com",
        pathname: "/**",
      },
      // Supabase Storage
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
