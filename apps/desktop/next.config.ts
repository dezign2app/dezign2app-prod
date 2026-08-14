import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile shared workspace packages
  transpilePackages: ["@workspace/ui", "@workspace/canvas"],
  // Allow cross-origin credentials (same as web app)
  crossOrigin: "use-credentials",
  // Required for Electron: don't add trailing slashes, keep clean URLs
  trailingSlash: false,
};

export default nextConfig;
