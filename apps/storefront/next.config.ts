import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile workspace packages
  transpilePackages: ["@vcecom/cms-blocks"],
  // Enable rewrites to proxy API requests and avoid CORS issues
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/:path*`,
      },
    ];
  },
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
