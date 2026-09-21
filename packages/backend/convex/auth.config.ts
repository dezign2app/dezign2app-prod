import { AuthConfig } from "convex/server";

// 1. Explicit environment variables
let siteUrl =
  process.env.CONVEX_SITE_URL ||
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  (process.env.CONVEX_URL ? process.env.CONVEX_URL.replace(".convex.cloud", ".convex.site") : "") ||
  (process.env.NEXT_PUBLIC_CONVEX_URL ? process.env.NEXT_PUBLIC_CONVEX_URL.replace(".convex.cloud", ".convex.site") : "");

// 2. If deploying via CI/CLI, dynamically extract deployment slug from CONVEX_DEPLOY_KEY or CONVEX_DEPLOYMENT
if (!siteUrl) {
  const deployKeyOrName = process.env.CONVEX_DEPLOY_KEY || process.env.CONVEX_DEPLOYMENT || "";
  const match = deployKeyOrName.match(/(?:prod|dev):([a-z0-9-]+)/i);
  if (match && match[1]) {
    siteUrl = `https://${match[1]}.convex.site`;
  }
}

const convexSiteUrl = siteUrl ? siteUrl.replace(/\/+$/, "") : "";

if (!convexSiteUrl && typeof console !== "undefined") {
  console.warn(
    "[auth.config] WARNING: Unable to resolve Convex site URL. Better Auth JWT verification may fail.",
  );
}

export default {
  providers: [
    {
      type: "customJwt",
      issuer: convexSiteUrl,
      applicationID: "convex",
      algorithm: "RS256",
      jwks: `${convexSiteUrl}/api/auth/convex/jwks`,
    },
  ],
} satisfies AuthConfig;
