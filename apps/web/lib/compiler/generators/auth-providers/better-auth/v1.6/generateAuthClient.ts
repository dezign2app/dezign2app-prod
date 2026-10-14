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

  const hasPasskey = plugins.some((p) => p === "passkey" || p === "passkeyClient");
  const standardPlugins = plugins.filter(
    (p) => p !== "passkey" && p !== "passkeyClient"
  );

  const standardPluginImports =
    standardPlugins.length > 0
      ? `\nimport { ${standardPlugins.join(", ")} } from "better-auth/client/plugins";`
      : "";
  const passkeyImport = hasPasskey
    ? `\nimport { passkeyClient } from "@better-auth/passkey/client";`
    : "";

  const allPluginCalls = [
    ...standardPlugins.map((p) => `    ${p}(),`),
    ...(hasPasskey ? ["    passkeyClient(),"] : []),
  ];

  const pluginEntries =
    allPluginCalls.length > 0
      ? `\n  plugins: [\n${allPluginCalls.join("\n")}\n  ],`
      : "";

  return `import { createAuthClient } from "better-auth/react";${standardPluginImports}${passkeyImport}

// Better Auth Browser Client instance initialized with server baseURL and plugins
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_AUTH_BASE_URL || "${baseUrl}",${pluginEntries}
});
`;
}

