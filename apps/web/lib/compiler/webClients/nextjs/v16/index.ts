import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import { DEFAULT_BETTER_AUTH_VERSION } from "@workspace/canvas";
import {
  Endpoint,
  AnyMessagingResource,
  UIEventItem,
  CompiledFile,
  CompiledWebClientResult,
} from "@workspace/canvas/types";
import { generateWebClientE2ETests } from "../../../generators/testGenerator";

import { LinkedEndpointInfo, PageInfo } from "./types";
import { getServicePort, resolveLinkedEndpoint } from "./endpointResolver";
import { labelToSlug, slugToComponentName } from "./slugUtils";
import { generateProjectConfigFiles } from "./configTemplates";
import {
  generateRootLayout,
  generateSectionLayout,
  generatePageLayout,
  generateEventComponent,
  generatePageCode,
  generateRootIndexPage,
  EventComponentMeta,
} from "./componentTemplates";
import { generateProxy } from "./middlewareTemplate";
import { generateAuthClient } from "../../../generators/auth-providers/better-auth/v1.6/generateAuthClient";
import { compileAuth } from "../../../compileAuth";

export type { LinkedEndpointInfo };
export { getServicePort, resolveLinkedEndpoint };

/**
 * Compiles WebClient nodes into Next.js App Router (v16.x) project structure
 */
export function compileNextjsV16WebClient(
  webClientNodes: BackendNode[],
  endpoints: (Endpoint & { nodeId: string })[] = [],
  events: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[] = [],
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  projectName: string = "Blueprint Monorepo",
  testCases: SimulationTestCase[] = [],
  appSlug?: string,
): CompiledWebClientResult {
  const files: CompiledFile[] = [];

  const pagesInfo: PageInfo[] = [];
  const usedSlugs = new Set<string>();

  const effectiveAppSlug =
    appSlug ||
    webClientNodes[0]?.data.appSlug ||
    "web-app";

  webClientNodes.forEach((node, idx) => {
    const rawLabel = node.data.label || `Page ${idx + 1}`;
    let slug = labelToSlug(rawLabel, idx);

    if (usedSlugs.has(slug)) {
      slug = `${slug}-${idx + 1}`;
    }
    usedSlugs.add(slug);

    const cleanLabel = rawLabel.trim().toLowerCase();
    const isRoot =
      node.data.isRoot === true ||
      cleanLabel === "home" ||
      cleanLabel === "index" ||
      cleanLabel === "/";
    const routePath = isRoot ? "/" : `/${slug}`;
    const componentName = slugToComponentName(slug);

    const routeGroup =
      node.data.routeGroup ||
      (node.data.accessType && node.data.accessType !== "public" ? "private" : "public");

    pagesInfo.push({
      nodeId: node.id,
      label: rawLabel,
      description: node.data.description,
      slug,
      routePath,
      componentName,
      isRoot,
      routeGroup,
      accessType: node.data.accessType || "public",
      allowedRoles: node.data.allowedRoles,
      requiredPlans: node.data.requiredPlans,
      allowedOrgRoles: node.data.allowedOrgRoles,
      redirectTo: node.data.redirectTo,
      isAuthPage: node.data.isAuthPage,
      appSlug: node.data.appSlug || effectiveAppSlug,
      appName: node.data.appName,
    });
  });

  // Generate Group Layouts (e.g. app/(public)/layout.tsx, app/(private)/layout.tsx)
  const routeGroups = new Set<string>();
  pagesInfo.forEach((p) => {
    if (p.routeGroup) routeGroups.add(p.routeGroup);
  });
  if (routeGroups.size === 0) routeGroups.add("public");

  routeGroups.forEach((groupName) => {
    files.push({
      filename: `app/(${groupName})/layout.tsx`,
      language: "typescript",
      content: generateSectionLayout(groupName),
    });
  });

  // Project configuration files
  files.push(...generateProjectConfigFiles(effectiveAppSlug));

  // Check if an AuthNode is explicitly connected to this WebClient/WebApp via an edge or authNodeId reference
  const authNode = allNodes.find((n) => n.type === "auth");
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
          pkgObj.devDependencies["@types/better-sqlite3"] = "^7.6.12";
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

  // Include @workspace/db dependency only if database nodes exist on canvas
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
  // Root Layout (required by Next.js App Router, contains <html> and <body>)
  const navLinksHtml = pagesInfo
    .map((p) => `<Link href="${p.routePath}" className="hover:underline">${p.label}</Link>`)
    .join("\n              ");

  files.push({
    filename: "app/layout.tsx",
    language: "typescript",
    content: generateRootLayout(projectName, navLinksHtml),
  });

  // Next.js Proxy/Middleware config template
  files.push({
    filename: "proxy.ts",
    language: "typescript",
    content: generateProxy(pagesInfo),
  });

  // Generate pages, individual event components, and page load fetch statements
  let hasExplicitRoot = false;

  webClientNodes.forEach((node, idx) => {
    const pageMeta = pagesInfo[idx]!;
    if (pageMeta.isRoot) {
      hasExplicitRoot = true;
    }

    const nodeEvents: UIEventItem[] = node.data?.events || [];
    const pageLoadEvents = nodeEvents.filter(
      (e) => (e.event as string) === "pageLoad" || e.name === "pageLoad",
    );
    const actionEvents = nodeEvents.filter(
      (e) => (e.event as string) !== "pageLoad" && e.name !== "pageLoad",
    );

    let pageLoadFetchStatements = "";
    if (pageLoadEvents.length > 0) {
      const statements: string[] = [];
      pageLoadEvents.forEach((evt) => {
        const link = resolveLinkedEndpoint(
          node.id,
          evt.id,
          allNodes,
          allEdges,
          endpoints,
        );
        const evtKey = evt.name || "pageLoad";
        if (link) {
          statements.push(`const res_${link.targetNodeId} = await fetch("${link.fullUrl}", { headers: { "Content-Type": "application/json" } });
        if (res_${link.targetNodeId}.ok) {
          results["${evtKey}"] = await res_${link.targetNodeId}.json();
        } else {
          results["${evtKey}"] = { error: "HTTP " + res_${link.targetNodeId}.status };
        }`);
        } else {
          statements.push(`results["${evtKey}"] = {
          message: "pageLoad event triggered on mount (no target endpoint connected in canvas)",
        };`);
        }
      });

      pageLoadFetchStatements = `setPageLoadLoading(true);
      setPageLoadError(null);
      try {
        const results: Record<string, any> = {};
        ${statements.join("\n")}
        setPageLoadData(${pageLoadEvents.length === 1} ? results["${pageLoadEvents[0]?.name || "pageLoad"}"] : results);
      } catch (err: any) {
        setPageLoadError(err.message || "Failed to load page data");
      } finally {
        setPageLoadLoading(false);
      }`;
    }

    const eventComponentsMeta: EventComponentMeta[] = [];

    actionEvents.forEach((evt, evtIdx) => {
      const link = resolveLinkedEndpoint(
        node.id,
        evt.id,
        allNodes,
        allEdges,
        endpoints,
      );
      const url = link ? link.fullUrl : "";
      const method = link ? link.method : "POST";
      const evtName = evt.name || `Action ${evtIdx + 1}`;
      const evtType = evt.event || "click";
      const compName = slugToComponentName(labelToSlug(evtName, evtIdx)).replace(/Page$/, "Action");

      eventComponentsMeta.push({
        componentName: compName,
        eventName: evtName,
        eventType: evtType,
        url,
        method,
      });

      const groupFolder = pageMeta.routeGroup ? `(${pageMeta.routeGroup})` : "(public)";
      const componentFilePath = pageMeta.isRoot
        ? `app/${groupFolder}/_components/${compName}.tsx`
        : `app/${groupFolder}/${pageMeta.slug}/_components/${compName}.tsx`;

      files.push({
        filename: componentFilePath,
        language: "typescript",
        content: generateEventComponent(evtName, evtType, url, method, compName),
      });
    });

    const pageCode = generatePageCode(
      pageMeta,
      pageLoadFetchStatements,
      eventComponentsMeta,
    );

    const groupFolder = pageMeta.routeGroup ? `(${pageMeta.routeGroup})` : "(public)";
    const targetFilePath = pageMeta.isRoot
      ? `app/${groupFolder}/page.tsx`
      : `app/${groupFolder}/${pageMeta.slug}/page.tsx`;

    files.push({
      filename: targetFilePath,
      language: "typescript",
      content: pageCode,
    });

    if (!pageMeta.isRoot) {
      files.push({
        filename: `app/${groupFolder}/${pageMeta.slug}/layout.tsx`,
        language: "typescript",
        content: generatePageLayout(pageMeta.slug),
      });
    }
  });

  if (!hasExplicitRoot) {
    const indexCards = pagesInfo
      .map(
        (p) => `
          <Link href="${p.routePath}" className="block bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-6 transition-all hover:shadow-lg group">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">${p.label}</h2>
              <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 font-mono">${p.routePath}</span>
            </div>
            <p className="text-slate-400 text-sm mb-4">${p.description || "Interactive Next.js page"}</p>
            <div className="flex items-center text-xs text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">
              Open Page &rarr;
            </div>
          </Link>`,
      )
      .join("\n");

    files.push({
      filename: "app/(public)/page.tsx",
      language: "typescript",
      content: generateRootIndexPage(projectName, indexCards),
    });
  }

  files.push(
    ...generateWebClientE2ETests(
      webClientNodes,
      endpoints,
      events,
      allNodes,
      allEdges,
      testCases,
    ),
  );

  const webClientName =
    webClientNodes.length === 1
      ? webClientNodes[0]?.data.label || "web-client"
      : "web-client";
  const webClientId =
    webClientNodes.length === 1 ? webClientNodes[0]!.id : "web-client";

  return {
    webClientId,
    webClientName,
    files,
  };
}
