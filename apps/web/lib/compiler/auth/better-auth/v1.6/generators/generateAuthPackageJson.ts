import { DEFAULT_BETTER_AUTH_VERSION } from "@workspace/canvas";
import { BetterAuthV16NodeData } from "../types";

/**
 * Generates `package.json` for standalone Better Auth server
 */
export function generateAuthPackageJson(data: BetterAuthV16NodeData): string {
  const rawVersion = data.version || DEFAULT_BETTER_AUTH_VERSION;
  const cleanVersion = rawVersion.replace(/^v/, "");
  const semverVersion = cleanVersion.split(".").length === 2 ? `${cleanVersion}.0` : cleanVersion;
  const name = (data.label || "auth-server")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/^-+|-+$/g, "") || "auth-server";

  return JSON.stringify(
    {
      name: `@workspace/${name}`,
      version: "0.0.0",
      private: true,
      description: data.description || `Authentication service for ${name}`,
      main: "dist/index.js",
      scripts: {
        build: "tsc",
        start: "node dist/index.js",
        dev: "ts-node-dev --respawn --watch .env src/index.ts",
        test: "vitest run",
      },
      dependencies: {
        "@workspace/db": "workspace:*",
        "@workspace/logger": "workspace:*",
        "better-auth": `^${semverVersion}`,
        hono: "^4.0.0",
        "@hono/node-server": "^1.11.0",
        "better-sqlite3": "^12.0.0",
        zod: "^3.24.2",
        dotenv: "^16.4.5",
      },
      devDependencies: {
        "@workspace/typescript-config": "workspace:*",
        "@types/better-sqlite3": "^7.6.12",
        "@types/node": "^20.11.0",
        "ts-node-dev": "^2.0.0",
        typescript: "^5.3.3",
        vitest: "^1.6.0",
      },
    },
    null,
    2
  );
}
