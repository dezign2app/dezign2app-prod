import { BackendNode, BackendEdge } from "@/types/canvas";
import { CompiledFile, CompiledServiceResult } from "@workspace/canvas/types";
import {
  CanvasAuthNodeData,
  DEFAULT_BETTER_AUTH_VERSION,
  EndpointHookConfig,
  DbHookConfig,
} from "@workspace/canvas";

interface AdapterConfig {
  importStatement: string;
  adapterCall: string;
}

const DEFAULT_SQLITE_CONFIG: AdapterConfig = {
  importStatement: `import Database from "better-sqlite3";\n`,
  adapterCall: `new Database(process.env.DATABASE_URL || "sqlite.db")`,
};

const ADAPTER_REGISTRY: Record<string, Record<string, AdapterConfig>> = {
  default: {
    "sqlite-raw": DEFAULT_SQLITE_CONFIG,
    drizzle: {
      importStatement: `import { drizzleAdapter } from "better-auth/adapters/drizzle";\nimport { db } from "./db";`,
      adapterCall: `drizzleAdapter(db, {\n    provider: "pg",\n  })`,
    },
    prisma: {
      importStatement: `import { prismaAdapter } from "better-auth/adapters/prisma";\nimport { PrismaClient } from "@prisma/client";\nconst prisma = new PrismaClient();`,
      adapterCall: `prismaAdapter(prisma, {\n    provider: "postgresql",\n  })`,
    },
    custom: {
      importStatement: `// Custom database adapter configuration`,
      adapterCall: `/* custom DB adapter */`,
    },
  },
};

function getAdapterConfig(version: string, adapterKey: string): AdapterConfig {
  const majorVersion = version.split(".")[0] + ".x";
  const versionRegistry = ADAPTER_REGISTRY[majorVersion] || ADAPTER_REGISTRY.default;
  const config = (versionRegistry && versionRegistry[adapterKey]) || DEFAULT_SQLITE_CONFIG;
  return config;
}

export type AuthNodeData = CanvasAuthNodeData & { label?: string };

/**
 * Generates the core `src/auth.ts` file for Better Auth
 */
export function generateAuthConfig(data: AuthNodeData): string {
  const version = data.version || DEFAULT_BETTER_AUTH_VERSION;
  const dbAdapterKey = data.dbAdapter || "sqlite-raw";
  const adapterConfig = getAdapterConfig(version, dbAdapterKey);

  const pluginImports = new Set<string>();
  const pluginCalls: string[] = [];

  // Always enable bearer plugin for API verification
  pluginImports.add("bearer");
  pluginCalls.push("bearer()");

  const enabledPlugins = data.plugins || ["bearer", "admin", "organization", "jwt"];

  if (enabledPlugins.includes("admin")) {
    pluginImports.add("admin");
    pluginCalls.push("admin()");
  }

  if (enabledPlugins.includes("twoFactor")) {
    pluginImports.add("twoFactor");
    pluginCalls.push("twoFactor()");
  }

  if (enabledPlugins.includes("passkey")) {
    pluginImports.add("passkey");
    pluginCalls.push("passkey()");
  }

  if (enabledPlugins.includes("magicLink")) {
    pluginImports.add("magicLink");
    pluginCalls.push("magicLink()");
  }

  if (enabledPlugins.includes("emailOtp")) {
    pluginImports.add("emailOtp");
    pluginCalls.push("emailOtp()");
  }

  if (enabledPlugins.includes("username")) {
    pluginImports.add("username");
    pluginCalls.push("username()");
  }

  if (enabledPlugins.includes("phoneNumber")) {
    pluginImports.add("phoneNumber");
    pluginCalls.push("phoneNumber()");
  }

  if (enabledPlugins.includes("apiKey")) {
    pluginImports.add("apiKey");
    pluginCalls.push("apiKey()");
  }

  if (enabledPlugins.includes("jwt")) {
    pluginImports.add("jwt");
    pluginCalls.push("jwt()");
  }

  if (enabledPlugins.includes("multiSession")) {
    pluginImports.add("multiSession");
    pluginCalls.push("multiSession()");
  }

  if (enabledPlugins.includes("sso")) {
    pluginImports.add("oidcProvider");
    pluginCalls.push("oidcProvider()");
  }

  // Organization plugin configuration
  const org = data.organization;
  if (org?.enabled !== false && (enabledPlugins.includes("organization") || org?.enabled)) {
    pluginImports.add("organization");
    const teamsEnabled = Boolean(org?.teams);
    pluginCalls.push(
      `organization({\n    teams: {\n      enabled: ${teamsEnabled},\n    },\n    allowUserToCreateOrganization: ${Boolean(org?.multiOrg ?? true)},\n  })`
    );
  }

  // customSession plugin configuration for session claims
  const sessionConfig = data.session;
  const sessionClaims = sessionConfig?.claims || [];
  const customSessionClaims = sessionClaims.filter(
    (c) => c.deliveryMode === "session" || c.destination === "session"
  );

  if (customSessionClaims.length > 0) {
    pluginImports.add("customSession");
    const claimFields = customSessionClaims
      .map((claim) => {
        const key = claim.key || "claim";
        if (claim.source === "orgRole") {
          return `        ${key}: session.activeOrganizationId ? "member" : undefined,`;
        }
        return `        ${key}: "${claim.targetValue || "default_value"}", // Resolved from ${claim.source}`;
      })
      .join("\n");

    pluginCalls.push(
      `customSession(async ({ user, session }) => {\n    return {\n      user,\n      session: {\n        ...session,\n${claimFields}\n      },\n    };\n  })`
    );
  }

  // Process Endpoint Hooks (hooks.before & hooks.after)
  const hooks = data.hooks || [];
  const endpointHooks = hooks.filter(
    (h): h is EndpointHookConfig => h.hookType === "endpoint" || ("event" in h && !("model" in h))
  );

  const beforeHooks = endpointHooks.filter((h) => h.phase === "before");
  const afterHooks = endpointHooks.filter((h) => (h.phase || "after") === "after");

  const buildPhaseMiddleware = (phaseHooks: EndpointHookConfig[], phaseName: "before" | "after") => {
    if (phaseHooks.length === 0) return null;

    const branches = phaseHooks.map((h, i) => {
      const path = h.event || "/sign-up";
      const condition = i === 0 ? `if (ctx.path === "${path}")` : `else if (ctx.path === "${path}")`;
      let body = "";
      if (h.mode === "code" && h.code) {
        body = h.code;
      } else {
        const promptComment = h.prompt ? `// ${h.prompt}\n        ` : "";
        body = phaseName === "before"
          ? `${promptComment}if (!ctx.body) {\n          throw new Error("Invalid request payload");\n        }`
          : `${promptComment}// Executed after ${path}\n        console.log("${phaseName} hook for ${path}");`;
      }
      return `      ${condition} {\n        ${body}\n      }`;
    }).join(" ");

    return `createAuthMiddleware(async (ctx) => {\n${branches}\n    })`;
  };

  const beforeMiddleware = buildPhaseMiddleware(beforeHooks, "before");
  const afterMiddleware = buildPhaseMiddleware(afterHooks, "after");

  let hooksBlock = "";
  if (beforeMiddleware || afterMiddleware) {
    const parts: string[] = [];
    if (beforeMiddleware) parts.push(`    before: ${beforeMiddleware}`);
    if (afterMiddleware) parts.push(`    after: ${afterMiddleware}`);
    hooksBlock = `\n  hooks: {\n${parts.join(",\n")}\n  },`;
  }

  // Process Database Hooks (databaseHooks.model.op.phase)
  const dbHooks = hooks.filter((h): h is DbHookConfig => h.hookType === "db" || "model" in h);
  let databaseHooksBlock = "";
  if (dbHooks.length > 0) {
    const modelTree: Record<string, Record<string, Record<string, string>>> = {};
    for (const h of dbHooks) {
      const model = h.model || "user";
      const op = h.operation || "create";
      const phase = h.phase || "after";
      let code = "";
      if (h.mode === "code" && h.code) {
        code = h.code;
      } else {
        const comment = h.prompt ? `// ${h.prompt}\n            ` : "";
        code = `async (${model}, ctx) => {\n            ${comment}// Post-${op} side effect for ${model}\n          }`;
      }

      if (!modelTree[model]) modelTree[model] = {};
      if (!modelTree[model][op]) modelTree[model][op] = {};
      modelTree[model][op][phase] = code;
    }

    const modelEntries = Object.entries(modelTree).map(([model, ops]) => {
      const opEntries = Object.entries(ops).map(([op, phases]) => {
        const phaseEntries = Object.entries(phases).map(([phase, code]) => `${phase}: ${code}`).join(",\n        ");
        return `      ${op}: {\n        ${phaseEntries}\n      }`;
      }).join(",\n");
      return `    ${model}: {\n${opEntries}\n    }`;
    }).join(",\n");

    databaseHooksBlock = `\n  databaseHooks: {\n${modelEntries}\n  },`;
  }

  // Providers Configuration
  const emailPassword = data.providers?.emailPassword;
  let emailPasswordBlock = "";
  if (emailPassword?.enabled !== false) {
    emailPasswordBlock = `\n  emailAndPassword: {\n    enabled: true,\n    requireEmailVerification: ${Boolean(emailPassword?.requireVerification)},\n    minPasswordLength: ${emailPassword?.minLength || 8},\n  },`;
  }

  // OAuth Social Providers
  const oauthProviders = data.providers?.oauth || [];
  const isSocialEnabled = data.providers?.socialEnabled ?? (oauthProviders.length > 0);
  let socialProvidersBlock = "";
  if (isSocialEnabled && oauthProviders.length > 0) {
    const providersList = oauthProviders.map((p) => {
      const providerName = p.provider || "google";
      const clientIdEnv = p.clientIdEnv || `${providerName.toUpperCase()}_CLIENT_ID`;
      const clientSecretEnv = p.clientSecretEnv || `${providerName.toUpperCase()}_CLIENT_SECRET`;
      return `    ${providerName}: {\n      clientId: process.env.${clientIdEnv} || "",\n      clientSecret: process.env.${clientSecretEnv} || "",\n    }`;
    }).join(",\n");
    socialProvidersBlock = `\n  socialProviders: {\n${providersList}\n  },`;
  }

  // Account Linking
  const accountLinking = data.providers?.accountLinking;
  let accountLinkingBlock = "";
  if (accountLinking) {
    const policy = accountLinking.policy || "merge";
    if (policy === "prompt") {
      accountLinkingBlock = `\n  account: {\n    accountLinking: {\n      enabled: true,\n      requireEmailVerification: false,\n      disableImplicitLinking: true,\n    },\n  },`;
    } else if (policy === "block") {
      accountLinkingBlock = `\n  account: {\n    accountLinking: {\n      enabled: false,\n    },\n  },`;
    } else {
      accountLinkingBlock = `\n  account: {\n    accountLinking: {\n      enabled: true,\n    },\n  },`;
    }
  }

  // Session Config
  let sessionBlock = "";
  if (sessionConfig) {
    const cookieCache = sessionConfig.cookieCache;
    const cookieCachePart = cookieCache?.enabled !== false
      ? `\n    cookieCache: {\n      enabled: true,\n      maxAge: ${cookieCache?.maxAgeSeconds ?? 300},\n    },`
      : "";

    sessionBlock = `\n  session: {\n    expiresIn: ${sessionConfig.expiresInSeconds ?? 604800},\n    updateAge: ${sessionConfig.updateAgeSeconds ?? 86400},${cookieCachePart}\n  },`;
  }

  // Trusted Origins
  const trustedOrigins = data.trustedOrigins || ["http://localhost:3000", "http://localhost:5173"];
  const trustedOriginsBlock = `\n  trustedOrigins: ${JSON.stringify(trustedOrigins)},`;

  // Secret Key
  const secretBlock = `\n  secret: process.env.BETTER_AUTH_SECRET || "default_super_secret_key_change_in_production",`;
  const baseUrlBlock = `\n  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",`;

  const customCallback = data.redirects?.callbackUrl;
  let basePathBlock = "";
  if (customCallback) {
    const cleanPath = customCallback.replace(/\/callback\/?$/, "").replace(/\/$/, "");
    if (cleanPath && cleanPath !== "/api/auth") {
      basePathBlock = `\n  basePath: "${cleanPath}",`;
    }
  }

  // Imports
  const pluginImportStr = pluginImports.size > 0
    ? `import { ${Array.from(pluginImports).join(", ")} } from "better-auth/plugins";\n`
    : "";

  const createMiddlewareImport = (beforeMiddleware || afterMiddleware)
    ? `import { createAuthMiddleware } from "better-auth/api";\n`
    : "";

  return `import { betterAuth } from "better-auth";
${adapterConfig.importStatement}
${createMiddlewareImport}${pluginImportStr}
export const auth = betterAuth({
  database: ${adapterConfig.adapterCall},${secretBlock}${baseUrlBlock}${basePathBlock}${emailPasswordBlock}${socialProvidersBlock}${accountLinkingBlock}${sessionBlock}${trustedOriginsBlock}${hooksBlock}${databaseHooksBlock}
  plugins: [
    ${pluginCalls.join(",\n    ")}
  ],
});
`;
}

/**
 * Generates the Hono server entry point (`src/index.ts`)
 */
export function generateAuthIndex(data: AuthNodeData): string {
  return `import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// Mount Better Auth HTTP handler at /api/auth/*
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

app.get("/health", (c) => c.json({ status: "ok", service: "${data.label || "auth-server"}" }));

const port = Number(process.env.PORT || 3001);
console.log(\`Better Auth Server running on http://localhost:\${port}\`);

serve({
  fetch: app.fetch,
  port,
});
`;
}

/**
 * Generates `auth_middleware.py` for FastAPI services to verify tokens against Better Auth server
 */
export function generateFastApiMiddleware(data: AuthNodeData): string {
  return `import os
import httpx
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer()

BETTER_AUTH_URL = os.getenv("BETTER_AUTH_URL", "http://localhost:3001")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates Bearer token or session cookie against Better Auth server endpoints.
    Returns the user dict or raises 401 Unauthorized.
    """
    token = credentials.credentials
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{BETTER_AUTH_URL}/api/auth/get-session",
                headers=headers,
                timeout=5.0
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            data = response.json()
            if not data or "user" not in data:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session not found",
                )
            return data["user"]
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Authentication service unavailable: {str(exc)}",
            )
`;
}

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
export function generateNextJsRouteHandler(data: AuthNodeData): string {
  return `import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const dynamic = "force-dynamic";

export const { POST, GET } = toNextJsHandler(auth);
`;
}

/**
 * Compiles a Canvas Auth Node into a complete `CompiledServiceResult`
 */
export function compileAuthNode(
  node: BackendNode,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = []
): CompiledServiceResult {
  const data = (node.data || {}) as AuthNodeData;
  const serviceName = data.label || "Auth Server";

  const files: CompiledFile[] = [
    {
      filename: "auth-server/src/auth.ts",
      language: "typescript",
      content: generateAuthConfig(data),
    },
    {
      filename: "auth-server/src/lib/auth.ts",
      language: "typescript",
      content: `export { auth } from "../auth";\n`,
    },
    {
      filename: "auth-server/src/app/api/auth/[...all]/route.ts",
      language: "typescript",
      content: generateNextJsRouteHandler(data),
    },
    {
      filename: "auth-server/src/index.ts",
      language: "typescript",
      content: generateAuthIndex(data),
    },
    {
      filename: "auth-server/package.json",
      language: "json",
      content: generatePackageJson(data),
    },
    {
      filename: "auth-server/.env.example",
      language: "env",
      content: generateEnvExample(data),
    },
    {
      filename: "auth-server/README.md",
      language: "markdown",
      content: generateReadme(data),
    },
    {
      filename: "fastapi-service/auth_middleware.py",
      language: "python",
      content: generateFastApiMiddleware(data),
    },
  ];

  return {
    serviceId: node.id,
    serviceName,
    files,
  };
}
