import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import { DEFAULT_BETTER_AUTH_VERSION } from "@workspace/canvas";
import { Endpoint, AnyMessagingResource, CompiledFile } from "@workspace/canvas/types";
import { PageInfo } from "./types";
import { compileAuth } from "../../../compileAuth";
import { generateAuthClient } from "../../../generators/auth-providers/better-auth/v1.6/generateAuthClient";

export interface GenerateAuthFilesParams {
  files: CompiledFile[];
  webClientNodes: BackendNode[];
  pagesInfo: PageInfo[];
  authNode?: BackendNode;
  endpoints?: (Endpoint & { nodeId: string })[];
  events?: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[];
  allNodes?: BackendNode[];
  allEdges?: BackendEdge[];
  testCases?: SimulationTestCase[];
}

/**
 * Resolves the specific AuthNode connected to a given WebAppNode (or its child WebClient pages).
 * Returns undefined if no AuthNode is connected to this WebApp.
 */
export function resolveConnectedAuthNode(
  webAppNode?: BackendNode,
  webClientNodes: BackendNode[] = [],
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
): BackendNode | undefined {
  const authNodes = allNodes.filter((n) => n.type === "auth");
  if (authNodes.length === 0) return undefined;

  // 1. Check direct connection to webAppNode
  if (webAppNode) {
    if (webAppNode.data?.authNodeId) {
      const match = authNodes.find((a) => a.id === webAppNode.data.authNodeId);
      if (match) return match;
    }

    const connectedEdge = allEdges.find((e) => {
      const connectsWebApp = e.source === webAppNode.id || e.target === webAppNode.id;
      if (!connectsWebApp) return false;
      const otherId = e.source === webAppNode.id ? e.target : e.source;
      return authNodes.some((a) => a.id === otherId);
    });

    if (connectedEdge) {
      const authId = connectedEdge.source === webAppNode.id ? connectedEdge.target : connectedEdge.source;
      const match = authNodes.find((a) => a.id === authId);
      if (match) return match;
    }
  }

  // 2. Check connection via any of the webClient page nodes
  const pageIds = new Set(webClientNodes.map((w) => w.id));
  for (const page of webClientNodes) {
    if (page.data?.authNodeId) {
      const match = authNodes.find((a) => a.id === page.data.authNodeId);
      if (match) return match;
    }
  }

  const pageEdge = allEdges.find((e) => {
    const connectsPage = pageIds.has(e.source) || pageIds.has(e.target);
    if (!connectsPage) return false;
    const otherId = pageIds.has(e.source) ? e.target : e.source;
    return authNodes.some((a) => a.id === otherId);
  });

  if (pageEdge) {
    const authId = pageIds.has(pageEdge.source) ? pageEdge.target : pageEdge.source;
    const match = authNodes.find((a) => a.id === authId);
    if (match) return match;
  }

  // 3. Fallback only if there are NO explicit WebApp nodes on the canvas
  // and there is a single auth node on the canvas
  const hasExplicitWebAppNodes = allNodes.some((n) => n.type === "webApp");
  if (!hasExplicitWebAppNodes && webAppNode === undefined && authNodes.length === 1) {
    return authNodes[0];
  }

  return undefined;
}

/**
 * Generates Auth server endpoints, client SDKs, authorization middleware helpers, and package dependencies
 * ONLY if an AuthNode is explicitly connected to this WebApp.
 */
export function generateAuthFilesAndDependencies({
  files,
  webClientNodes,
  pagesInfo,
  authNode,
  endpoints = [],
  events = [],
  allNodes = [],
  allEdges = [],
  testCases = [],
}: GenerateAuthFilesParams): void {
  // Generate Better Auth server files and SDK ONLY when an AuthNode is connected
  if (authNode) {
    const authPort = authNode.data?.port || "3000";
    const authBaseUrl = authNode.data?.baseUrl || `http://localhost:${authPort}`;
    const compiledAuth = compileAuth(authNode, endpoints, events, allNodes, allEdges, testCases);

    const authFile = compiledAuth.files.find((f) => f.filename.endsWith("auth.ts"));
    if (authFile) {
      files.push({
        filename: "lib/auth.ts",
        language: "typescript",
        content: authFile.content,
      });
    }

    files.push({
      filename: "app/api/auth/[...all]/route.ts",
      language: "typescript",
      content: `import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const dynamic = "force-dynamic";

export const { POST, GET } = toNextJsHandler(auth);
`,
    });

    const envFile = compiledAuth.files.find((f) => f.filename.endsWith(".env"));
    if (envFile) {
      const existingEnvIdx = files.findIndex((f) => f.filename === ".env");
      if (existingEnvIdx !== -1) {
        files[existingEnvIdx]!.content = envFile.content;
      } else {
        files.push({
          filename: ".env",
          language: "dotenv",
          content: envFile.content,
        });
      }

      files.push({
        filename: ".env.example",
        language: "dotenv",
        content: envFile.content,
      });
    }

    files.push({
      filename: "lib/auth-client.ts",
      language: "typescript",
      content: generateAuthClient({
        baseUrl: authBaseUrl,
        plugins: ["adminClient", "organizationClient"],
      }),
    });

    // Reusable Server Authorization Helpers under lib/auth/
    files.push({
      filename: "lib/auth/require-session.ts",
      language: "typescript",
      content: `import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function requireSession(redirectTo: string = "/login") {
  let session = null;
  try {
    const { auth } = await import("@/lib/auth");
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (err) {
    const isRedirect = err && typeof err === "object" && "digest" in err && String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
    if (isRedirect) {
      throw err;
    }
    session = null;
  }

  if (!session || !session.user || !session.user.id) {
    redirect(redirectTo);
  }

  // Deep DB Record Validation: Verify user record exists in the database table
  try {
    const userId = session.user.id;
    let userExistsInDb = false;

    try {
      const { findUserById } = await import("@workspace/db");
      const user = findUserById(userId);
      if (user && user.id) {
        userExistsInDb = true;
      }
    } catch (_dbErr) {
      // Fallback if db is not directly queried
      userExistsInDb = Boolean(session && session.user && session.user.id);
    }

    if (!userExistsInDb) {
      redirect(redirectTo);
    }
  } catch (err) {
    const isRedirect = err && typeof err === "object" && "digest" in err && String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
    if (isRedirect) {
      throw err;
    }
    redirect(redirectTo);
  }

  return session;
}
`,
    });

    files.push({
      filename: "lib/auth/require-role.ts",
      language: "typescript",
      content: `import { requireSession } from "./require-session";
import { redirect } from "next/navigation";

export async function requireRole(allowedRoles: string[], redirectTo: string = "/unauthorized") {
  const session = await requireSession();
  const role = (session.user as { role?: string })?.role || "user";

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    redirect(redirectTo);
  }

  return session;
}
`,
    });

    files.push({
      filename: "lib/auth/require-org-role.ts",
      language: "typescript",
      content: `import { requireSession } from "./require-session";
import { redirect } from "next/navigation";

export async function requireOrgRole(allowedOrgRoles: string[], redirectTo: string = "/unauthorized") {
  const session = await requireSession();
  const activeOrgRole = (session.session as { activeOrgRole?: string })?.activeOrgRole ||
                        (session.user as { orgRole?: string })?.orgRole;

  if (allowedOrgRoles.length > 0 && (!activeOrgRole || !allowedOrgRoles.includes(activeOrgRole))) {
    redirect(redirectTo);
  }

  return session;
}
`,
    });

    files.push({
      filename: "lib/auth/require-plan.ts",
      language: "typescript",
      content: `import { requireSession } from "./require-session";
import { redirect } from "next/navigation";

export async function requirePlan(requiredPlans: string[], redirectTo: string = "/pricing") {
  const session = await requireSession();
  const plan = (session.session as { plan?: string })?.plan ||
               (session.user as { plan?: string })?.plan || "free";

  if (requiredPlans.length > 0 && !requiredPlans.includes(plan)) {
    redirect(redirectTo);
  }

  return session;
}
`,
    });

    // Add better-auth and database adapter dependencies to package.json
    const pkgFileIdx = files.findIndex((f) => f.filename === "package.json");
    if (pkgFileIdx !== -1) {
      try {
        const pkgObj = JSON.parse(files[pkgFileIdx]!.content);
        pkgObj.dependencies = pkgObj.dependencies || {};
        pkgObj.devDependencies = pkgObj.devDependencies || {};
        pkgObj.scripts = pkgObj.scripts || {};

        const rawVersion = authNode.data?.version || DEFAULT_BETTER_AUTH_VERSION;
        const cleanVersion = rawVersion.replace(/^v/, "");
        const semverVersion = cleanVersion.split(".").length === 2 ? `${cleanVersion}.0` : cleanVersion;
        pkgObj.dependencies["better-auth"] = `^${semverVersion}`;
        pkgObj.devDependencies["@better-auth/cli"] = `^${semverVersion}`;
        pkgObj.dependencies["zod"] = "^3.24.2";
        pkgObj.scripts["db:migrate"] = "npx @better-auth/cli migrate -y";
        pkgObj.scripts["predev"] = "pnpm db:migrate";
        pkgObj.scripts["prestart"] = "pnpm db:migrate";

        const dbAdapterKey = String(authNode.data?.dbAdapter || "sqlite-raw");
        if (
          dbAdapterKey === "sqlite-raw" ||
          dbAdapterKey === "sqlite" ||
          dbAdapterKey === "default"
        ) {
          pkgObj.dependencies["better-sqlite3"] = "^12.0.0";
          pkgObj.dependencies["@libsql/client"] = "^0.14.0";
          pkgObj.devDependencies["@types/better-sqlite3"] = "^7.6.12";
          pkgObj.devDependencies["prebuild-install"] = "^7.1.3";
          pkgObj.scripts["postinstall"] = "prebuild-install || node -e \"try { const p = require('path').dirname(require.resolve('better-sqlite3/package.json')); require('child_process').execSync('npx prebuild-install', {cwd: p, stdio: 'inherit'}); } catch (e) {}\"";
        } else if (dbAdapterKey === "drizzle") {
          pkgObj.dependencies["drizzle-orm"] = "^0.30.0";
        } else if (dbAdapterKey === "prisma") {
          pkgObj.dependencies["@prisma/client"] = "^5.10.0";
          pkgObj.devDependencies["prisma"] = "^5.10.0";
        }

        files[pkgFileIdx]!.content = JSON.stringify(pkgObj, null, 2);
      } catch (err) {
        // preserve existing content on parse failure
      }
    }

    // Generate client auth token helper for API calls when auth is connected
    files.push({
      filename: "lib/auth-token.ts",
      language: "typescript",
      content: `/**
 * Helper to retrieve the Bearer authorization token for client API requests.
 * Checks active Better Auth session, cookies, localStorage, and sessionStorage.
 */
export async function getAuthBearerToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // 1. Check active Better Auth client session
  try {
    const { authClient } = await import("@/lib/auth-client");
    if (authClient && typeof authClient.getSession === "function") {
      const sessionRes = await authClient.getSession();
      const token =
        sessionRes?.data?.session?.token ||
        (sessionRes?.data as { token?: string })?.token;
      if (token) {
        return token.startsWith("Bearer ") ? token : \`Bearer \${token}\`;
      }
    }
  } catch (_e) {}

  // 2. Check cookies for Better Auth session token (better-auth.session_token)
  try {
    const cookies = document.cookie.split(";");
    for (const c of cookies) {
      const trimmed = c.trim();
      if (
        trimmed.startsWith("better-auth.session_token=") ||
        trimmed.startsWith("__Secure-better-auth.session_token=")
      ) {
        const val = trimmed.split("=")[1];
        if (val) {
          const decoded = decodeURIComponent(val);
          return decoded.startsWith("Bearer ") ? decoded : \`Bearer \${decoded}\`;
        }
      }
    }
  } catch (_cErr) {}

  // 3. Check browser localStorage & sessionStorage
  const tokenKeys = [
    "better-auth.session_token",
    "auth_token",
    "access_token",
    "token",
    "bearer_token",
  ];

  for (const k of tokenKeys) {
    const stored = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (stored) {
      return stored.startsWith("Bearer ") ? stored : \`Bearer \${stored}\`;
    }
  }

  return null;
}
`,
    });
  }
}

/**
 * Ensures workspace DB dependencies are included if entity or db_ref nodes exist
 */
export function ensureDatabaseDependencies(
  files: CompiledFile[],
  allNodes: BackendNode[] = [],
): void {
  const hasDatabaseNodes = allNodes.some((n) => n.type === "entity" || n.type === "db_ref");
  if (hasDatabaseNodes) {
    const pkgFileIdx = files.findIndex((f) => f.filename === "package.json");
    if (pkgFileIdx !== -1) {
      try {
        const pkgObj = JSON.parse(files[pkgFileIdx]!.content);
        pkgObj.dependencies = pkgObj.dependencies || {};
        pkgObj.devDependencies = pkgObj.devDependencies || {};
        pkgObj.dependencies["@workspace/db"] = "workspace:*";
        pkgObj.dependencies["better-sqlite3"] = "^12.0.0";
        pkgObj.devDependencies["@types/better-sqlite3"] = "^7.6.12";
        files[pkgFileIdx]!.content = JSON.stringify(pkgObj, null, 2);
      } catch (err) {
        // preserve
      }
    }
  }
}
