import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  "https://neighborly-setter-541.convex.cloud";

const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  convexUrl.replace(".convex.cloud", ".convex.site");

export const { GET, POST } = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
}).handler;
