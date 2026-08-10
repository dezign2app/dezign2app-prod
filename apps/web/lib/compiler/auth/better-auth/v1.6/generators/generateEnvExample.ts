import { BetterAuthV16NodeData } from "../types";
import { resolveOAuthProviders } from "../providers";

/**
 * Generates `.env` and `.env.example` file contents for Better Auth
 */
export function generateEnvExample(data: BetterAuthV16NodeData): string {
  const oauthProviders = resolveOAuthProviders(data);

  let oauthEnvs = "";
  if (oauthProviders.length > 0) {
    oauthEnvs =
      "\n# =====================================================================\n" +
      "# OAuth 2.0 / Social Authentication Provider Keys (AuthProvidersSection.tsx)\n" +
      "# Obtain these Client IDs and Secrets from your Provider Developer Consoles\n" +
      "# =====================================================================\n" +
      oauthProviders
        .map((p) => {
          const providerName = (p.provider || "google").toUpperCase();
          const idKey = p.clientIdEnv || `${providerName}_CLIENT_ID`;
          const secretKey = p.clientSecretEnv || `${providerName}_CLIENT_SECRET`;
          return `# ${p.provider || "OAuth"} Social Provider Credentials\n${idKey}=your_${p.provider || "oauth"}_client_id_here\n${secretKey}=your_${p.provider || "oauth"}_client_secret_here`;
        })
        .join("\n\n");
  }

  const port = data.port || "3001";
  const baseUrl = data.baseUrl || `http://localhost:${port}`;

  return `# =====================================================================
# Better Auth Core Environment Configuration
# =====================================================================

# Server HTTP Port
PORT=${port}

# Secret key used to sign & encrypt cookies, session tokens, JWTs, and CSRF protection
# WARNING: Change this to a random 32+ character string in production!
BETTER_AUTH_SECRET=your_super_secret_key_change_in_production

# Server Base URL — Used by Better Auth to construct OAuth redirect callback URLs
BETTER_AUTH_URL=${baseUrl}

# Public Server URL — Exposed to Next.js browser client for authClient API calls
NEXT_PUBLIC_BETTER_AUTH_URL=${baseUrl}
NEXT_PUBLIC_AUTH_BASE_URL=${baseUrl}

# Database Connection URL (used by better-sqlite3)
DATABASE_URL=sqlite.db${oauthEnvs}
`;
}
