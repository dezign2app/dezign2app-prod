import { DEFAULT_BETTER_AUTH_VERSION } from "@workspace/canvas";
import { AuthNodeData } from "./generateAuthConfig";

/**
 * Generates `package.json` for standalone Better Auth server
 */
export function generatePackageJson(data: AuthNodeData): string {
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
        postinstall: "pnpm rebuild better-sqlite3",
      },
      dependencies: {
        "better-auth": `^${version}`,
        hono: "^4.0.0",
        "@hono/node-server": "^1.11.0",
        "better-sqlite3": "^12.0.0",
        zod: "^4.0.0",
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

/**
 * Generates `.env.example`
 */
export function generateEnvExample(data: AuthNodeData): string {
  const oauthProviders = data.providers?.oauth || [];
  let oauthEnvs = "";
  if (oauthProviders.length > 0) {
    oauthEnvs = oauthProviders
      .map(
        (p) =>
          `${p.clientIdEnv || `${(p.provider || "google").toUpperCase()}_CLIENT_ID`}=your_${p.provider}_client_id\n${
            p.clientSecretEnv || `${(p.provider || "google").toUpperCase()}_CLIENT_SECRET`
          }=your_${p.provider}_client_secret`
      )
      .join("\n");
    oauthEnvs = `\n# OAuth Credentials\n${oauthEnvs}`;
  }

  return `# Better Auth Server Configuration
PORT=3001
BETTER_AUTH_SECRET=your_super_secret_key_change_in_production
BETTER_AUTH_URL=http://localhost:3001
DATABASE_URL=sqlite.db
${oauthEnvs}
`;
}

/**
 * Generates `README.md`
 */
export function generateReadme(data: AuthNodeData): string {
  const serviceName = data.label || "Auth Server";
  return `# ${serviceName} (Better Auth Standalone Service)

This service provides authentication endpoints for your system architecture canvas.

## Features
- Framework: Better Auth (v${data.version || DEFAULT_BETTER_AUTH_VERSION}) + Hono Server
- Native Cookie Sessions & Bearer Token Authentication
- Integrated with FastAPI Python backend via \`auth_middleware.py\`

## Quick Start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Setup environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Run in development mode:
   \`\`\`bash
   npm run dev
   \`\`\`

The Better Auth server will start on \`http://localhost:3001\`.
Authentication endpoints are mounted at \`/api/auth/*\` (e.g. \`/api/auth/sign-in\`, \`/api/auth/get-session\`).
`;
}

/**
 * Generates `src/app/api/auth/[...all]/route.ts` for Next.js App Router integration
 */
export function generateNextJsRouteHandler(_data: AuthNodeData): string {
  return `import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const dynamic = "force-dynamic";

export const { POST, GET } = toNextJsHandler(auth);
`;
}
