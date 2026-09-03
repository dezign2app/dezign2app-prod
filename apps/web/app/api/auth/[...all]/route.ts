import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  process.env.CONVEX_URL ||
  "";

const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  process.env.CONVEX_SITE_URL ||
  (convexUrl ? convexUrl.replace(".convex.cloud", ".convex.site") : "");

export const { GET, POST } = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
}).handler;
