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
 * Generates Auth server endpoints, client SDKs, authorization middleware helpers, and package dependencies
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
  const authPort = authNode?.data?.port || "3000";
  const authBaseUrl = authNode?.data?.baseUrl || `http://localhost:${authPort}`;

  const webNodeIds = new Set<string>();
  webClientNodes.forEach((w) => webNodeIds.add(w.id));
  allNodes
    .filter((n) => n.type === "webApp" || n.type === "webClient" || n.data?.isWebClient)
    .forEach((n) => webNodeIds.add(n.id));

  const isAuthNodeConnected = authNode
    ? allEdges.some((edge) => {
        const connectsAuth = edge.source === authNode.id || edge.target === authNode.id;
        const connectsWeb = webNodeIds.has(edge.source) || webNodeIds.has(edge.target);
        return connectsAuth && connectsWeb;
      }) ||
      webClientNodes.some((w) => w.data?.authNodeId === authNode.id) ||
      allNodes.some(
        (n) => (n.type === "webApp" || n.type === "webClient") && n.data?.authNodeId === authNode.id
      )
    : false;

  const hasProtectedRoutes = pagesInfo.some((p) => p.accessType && p.accessType !== "public");

  // ONLY generate Auth server files if an AuthNode is explicitly CONNECTED to this Web App
  if (isAuthNodeConnected && authNode) {
    const compiledAuth = compileAuth(authNode, endpoints, events, allNodes, allEdges, testCases);

    const authFile = compiledAuth.files.find((f) => f.filename.endsWith("auth.ts"));
    if (authFile) {
      files.push({
        filename: "lib/auth.ts",
        language: "typescript",
        content: authFile.content,
      });
    }

    const routeFile = compiledAuth.files.find((f) => f.filename.endsWith("route.ts"));
    if (routeFile) {
      files.push({
        filename: "app/api/auth/[...all]/route.ts",
        language: "typescript",
        content: routeFile.content,
      });
    }

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
      const Database = (await import("better-sqlite3")).default;
      const db = new Database(process.env.DATABASE_URL || "sqlite.db");
      const row = db.prepare("SELECT id FROM user WHERE id = ?").get(userId);
      db.close();
      if (row && (row as { id: string }).id) {
        userExistsInDb = true;
      }
    } catch (_dbErr) {
      // Fallback if sqlite is not used directly
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

        const rawVersion = authNode.data?.version || DEFAULT_BETTER_AUTH_VERSION;
        const cleanVersion = rawVersion.replace(/^v/, "");
        const semverVersion = cleanVersion.split(".").length === 2 ? `${cleanVersion}.0` : cleanVersion;
        pkgObj.dependencies["better-auth"] = `^${semverVersion}`;
        pkgObj.dependencies["zod"] = "^4.4.3";

        const dbAdapterKey = String(authNode.data?.dbAdapter || "sqlite-raw");
        if (
          dbAdapterKey === "sqlite-raw" ||
          dbAdapterKey === "sqlite" ||
          dbAdapterKey === "default"
        ) {
          pkgObj.dependencies["better-sqlite3"] = "^12.0.0";
          pkgObj.dependencies["@libsql/client"] = "^0.14.0";
          pkgObj.devDependencies["@types/better-sqlite3"] = "^7.6.12";
          pkgObj.scripts = pkgObj.scripts || {};
          pkgObj.scripts["postinstall"] = "node -e \"try { const p = require('path').dirname(require.resolve('better-sqlite3/package.json')); require('child_process').execSync('npx prebuild-install', {cwd: p, stdio: 'inherit'}); } catch (e) {}\"";
          pkgObj.devDependencies["prebuild-install"] = "^7.1.3";
          pkgObj.scripts = pkgObj.scripts || {};
          pkgObj.scripts["postinstall"] = "prebuild-install || pnpm rebuild better-sqlite3";
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
  } else if (hasProtectedRoutes || authNode) {
    // If protected routes exist or an AuthNode is on canvas but NOT connected to this app, only generate client helper if needed
    if (hasProtectedRoutes) {
      files.push({
        filename: "lib/auth-client.ts",
        language: "typescript",
        content: generateAuthClient({
          baseUrl: authBaseUrl,
          plugins: ["adminClient", "organizationClient"],
        }),
      });

      const pkgFileIdx = files.findIndex((f) => f.filename === "package.json");
      if (pkgFileIdx !== -1) {
        try {
          const pkgObj = JSON.parse(files[pkgFileIdx]!.content);
          pkgObj.dependencies = pkgObj.dependencies || {};
          const rawVersion = authNode?.data?.version || DEFAULT_BETTER_AUTH_VERSION;
          const cleanVersion = rawVersion.replace(/^v/, "");
          const semverVersion = cleanVersion.split(".").length === 2 ? `${cleanVersion}.0` : cleanVersion;
          pkgObj.dependencies["better-auth"] = `^${semverVersion}`;
          pkgObj.dependencies["zod"] = "^4.4.3";
          files[pkgFileIdx]!.content = JSON.stringify(pkgObj, null, 2);
        } catch (err) {
          // preserve
        }
      }
    }
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
