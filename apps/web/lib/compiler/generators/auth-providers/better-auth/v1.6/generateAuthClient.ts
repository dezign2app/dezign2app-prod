export interface BetterAuthClientOptions {
  baseUrl?: string;
  baseURL?: string;
  plugins?: string[];
}

export function generateAuthClient(options: BetterAuthClientOptions = {}): string {
  const baseUrl = options.baseURL || options.baseUrl || "http://localhost:3000";
  const plugins =
    options.plugins && options.plugins.length > 0
      ? options.plugins
      : ["adminClient", "organizationClient"];

  const pluginImports =
    plugins.length > 0
      ? `\nimport { ${plugins.join(", ")} } from "better-auth/client/plugins";`
      : "";

  const pluginEntries =
    plugins.length > 0
      ? `\n  plugins: [\n${plugins.map((p) => `    ${p}(),`).join("\n")}\n  ],`
      : "";

  return `import { createAuthClient } from "better-auth/react";${pluginImports}

// Better Auth Browser Client instance initialized with server baseURL and plugins
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_AUTH_BASE_URL || "${baseUrl}",${pluginEntries}
});
`;
}

