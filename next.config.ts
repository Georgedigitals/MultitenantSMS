import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the production container small by copying only Next's traced runtime files.
  output: 'standalone',
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
