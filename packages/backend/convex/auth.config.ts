import { AuthConfig } from "convex/server";

const convexSiteUrl =
  process.env.CONVEX_SITE_URL || "https://neighborly-setter-541.convex.site";

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
