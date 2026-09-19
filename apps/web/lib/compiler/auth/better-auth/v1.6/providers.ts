import { OAuthProviderConfig } from "@workspace/canvas";
import { BetterAuthV16NodeData } from "./types";

export function resolveOAuthProviders(data: BetterAuthV16NodeData): OAuthProviderConfig[] {
  const providers = data.providers;
  if (!providers) {
    return [];
  }

  // If social auth is explicitly disabled, return empty array
  if (providers.socialEnabled === false || providers.oauthEnabled === false) {
    return [];
  }

  // Only return providers that are explicitly configured in the oauth array
  if (Array.isArray(providers.oauth) && providers.oauth.length > 0) {
    return providers.oauth
      .filter((oa) => Boolean(oa && oa.provider && oa.provider.trim()))
      .map((oa) => ({
        ...oa,
        provider: oa.provider.trim().toLowerCase(),
      }));
  }

  // If no providers configured, return empty array (show only what is configured)
  return [];
}
