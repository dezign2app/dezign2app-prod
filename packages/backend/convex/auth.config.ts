import { AuthConfig } from "convex/server";

const convexSiteUrl =
  process.env.CONVEX_SITE_URL ||
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  (process.env.CONVEX_URL ? process.env.CONVEX_URL.replace(".convex.cloud", ".convex.site") : "");

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
