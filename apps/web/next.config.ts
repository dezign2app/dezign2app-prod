import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@workspace/ui"],
  crossOrigin: "use-credentials",
  experimental: {
    mcpServer: true,
  },
};

export default nextConfig;
