import { OAuthProviderConfig } from "@workspace/canvas";
import { BetterAuthV17NodeData } from "./types";

export function resolveOAuthProviders(data: BetterAuthV17NodeData): OAuthProviderConfig[] {
  const isSocialEnabled = data.providers?.socialEnabled ?? data.providers?.oauthEnabled ?? true;
  if (!isSocialEnabled) {
    return [];
  }

  if (Array.isArray(data.providers?.oauth)) {
    return data.providers!.oauth!;
  }

  // Fallback for uninitialized AuthNode data: default to Google and GitHub
  return [
    { id: "oa-1", provider: "google", clientIdEnv: "GOOGLE_CLIENT_ID", clientSecretEnv: "GOOGLE_CLIENT_SECRET" },
    { id: "oa-2", provider: "github", clientIdEnv: "GITHUB_CLIENT_ID", clientSecretEnv: "GITHUB_CLIENT_SECRET" },
  ];
}
