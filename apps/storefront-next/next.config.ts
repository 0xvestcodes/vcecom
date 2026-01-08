import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: "standalone",
  /* config options here */
  reactCompiler: true,
};

export default nextConfig;
