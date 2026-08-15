/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@wterm/dom", "@wterm/react"],
  crossOrigin: "use-credentials",
  experimental: {
    mcpServer: true,
  },
};

export default nextConfig;
