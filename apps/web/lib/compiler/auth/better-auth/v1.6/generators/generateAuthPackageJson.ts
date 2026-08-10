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
      name,
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "tsx src/index.ts",
        build: "tsc",
        start: "node dist/index.js",
        postinstall: "pnpm rebuild better-sqlite3",
      },
      dependencies: {
        "better-auth": `^${semverVersion}`,
        hono: "^4.0.0",
        "@hono/node-server": "^1.11.0",
        "better-sqlite3": "^12.0.0",
        zod: "^4.4.3",
        dotenv: "^16.4.5",
      },
      devDependencies: {
        "@types/better-sqlite3": "^7.6.12",
        "@types/node": "^20.14.0",
        typescript: "^5.4.5",
        tsx: "^4.19.0",
      },
    },
    null,
    2
  );
}
