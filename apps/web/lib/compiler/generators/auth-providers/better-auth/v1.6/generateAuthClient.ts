export interface BetterAuthClientOptions {
  baseUrl?: string;
  plugins?: string[];
}

export function generateAuthClient(options: BetterAuthClientOptions = {}): string {
  const baseUrl = options.baseUrl || "http://localhost:3000";
  const plugins = options.plugins || ["adminClient", "organizationClient"];

  return `import { createAuthClient } from "better-auth/react";
import { ${plugins.join(", ")} } from "better-auth/client/plugins";

// Better Auth Browser Client instance initialized with server baseURL and plugins
export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseUrl: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_AUTH_BASE_URL || "${baseUrl}",
  plugins: [
${plugins.map((p) => `    ${p}(),`).join("\n")}
  ],
});
`;
}
