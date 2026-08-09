import { DEFAULT_BETTER_AUTH_VERSION } from "@workspace/canvas";
import { BetterAuthV17NodeData } from "../types";

/**
 * Generates `package.json` for standalone Better Auth server
 */
export function generateAuthPackageJson(data: BetterAuthV17NodeData): string {
  const version = data.version || DEFAULT_BETTER_AUTH_VERSION;
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
      },
      dependencies: {
        "better-auth": `^${version}`,
        hono: "^4.0.0",
        "@hono/node-server": "^1.11.0",
        "better-sqlite3": "^11.0.0",
        dotenv: "^16.4.5",
      },
      devDependencies: {
        "@types/better-sqlite3": "^7.6.11",
        "@types/node": "^20.14.0",
        typescript: "^5.4.5",
        tsx: "^4.19.0",
      },
    },
    null,
    2
  );
}
