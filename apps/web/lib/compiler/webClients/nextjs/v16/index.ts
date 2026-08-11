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
  generateEventComponent,
  generatePageHeaderComponent,
  generateRootIndexHeaderComponent,
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

  const webAppNode = allNodes.find((n) => n.type === "webApp");

  const defaultZones = [
    {
      id: "zone-public",
      name: "Public Section",
      handleId: "public-in",
      accessType: "public",
      rule: {
        id: "rule-public",
        scope: "zone",
        conditions: { kind: "leaf", condition: { type: "auth", op: "signedOut" } },
        redirects: { default: "/login" },
      },
    },
    {
      id: "zone-private",
      name: "Private Section",
      handleId: "private-in",
      accessType: "protected",
      rule: {
        id: "rule-private",
        scope: "zone",
        conditions: { kind: "leaf", condition: { type: "auth", op: "signedIn" } },
        redirects: { "no-auth": "/login", default: "/login" },
      },
    },
  ];

  const appZones =
    webAppNode && Array.isArray(webAppNode.data?.zones) && webAppNode.data.zones.length > 0
      ? webAppNode.data.zones
      : defaultZones;

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

    // Find edge connecting a webApp node handle to this webClient node handle
    const connectedEdge = allEdges.find((e) => {
      const isTarget = e.target === node.id;
      const isSource = e.source === node.id;
      if (!isTarget && !isSource) return false;
      const otherId = isSource ? e.target : e.source;
      return webAppNode ? otherId === webAppNode.id : allNodes.some((n) => n.id === otherId && n.type === "webApp");
    });

    let matchedZone: any;
    if (connectedEdge && webAppNode) {
      const sectionHandleId =
        connectedEdge.source === webAppNode.id
          ? connectedEdge.sourceHandle
          : connectedEdge.targetHandle;
      matchedZone = appZones.find((z: any) => z.handleId === sectionHandleId);
    }

    if (!matchedZone && node.data.zoneId) {
      matchedZone = appZones.find((z: any) => z.id === node.data.zoneId);
    }

    let accessType: "public" | "private" | "role-gated" | "payment-gated" | "org-gated" = "public";
    let redirectTo = node.data.redirectTo || "/login";
    let allowedOrgRoles: string[] = node.data.allowedOrgRoles || [];
    let requiredPlans: string[] = node.data.requiredPlans || [];

    if (matchedZone) {
      const isPublicZone = matchedZone.accessType === "public" || matchedZone.id === "zone-public";
      if (isPublicZone) {
        accessType = "public";
      } else {
        accessType = "private";
        if (matchedZone.rule?.redirects) {
          redirectTo =
            matchedZone.rule.redirects["no-auth"] ||
            matchedZone.rule.redirects["default"] ||
            "/login";
        }

        if (matchedZone.rule?.conditions) {
          const extractConditions = (condNode: any) => {
            if (!condNode) return;
            if (condNode.kind === "leaf" && condNode.condition) {
              const cond = condNode.condition;
              if (cond.type === "orgRole" && Array.isArray(cond.values)) {
                allowedOrgRoles = [...allowedOrgRoles, ...cond.values];
              }
              if ((cond.type === "plan" || cond.type === "subscriptionStatus") && Array.isArray(cond.values)) {
                requiredPlans = [...requiredPlans, ...cond.values];
              }
            } else if (condNode.kind === "group" && Array.isArray(condNode.children)) {
              condNode.children.forEach(extractConditions);
            }
          };
          extractConditions(matchedZone.rule.conditions);
        }
      }
    } else {
      accessType = node.data.accessType || "public";
    }

    const routeGroup =
      node.data.routeGroup ||
      (accessType !== "public" ? "private" : "public");

    pagesInfo.push({
      nodeId: node.id,
      label: rawLabel,
      description: node.data.description,
      slug,
      routePath,
      componentName,
      isRoot,
      routeGroup,
      accessType,
      allowedRoles: node.data.allowedRoles,
      requiredPlans: requiredPlans.length > 0 ? Array.from(new Set(requiredPlans)) : undefined,
      allowedOrgRoles: allowedOrgRoles.length > 0 ? Array.from(new Set(allowedOrgRoles)) : undefined,
      redirectTo,
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

    const groupFolder = pageMeta.routeGroup ? `(${pageMeta.routeGroup})` : "(public)";
    const headerCompName = `${pageMeta.componentName}Header`;
    const headerFilePath = pageMeta.isRoot
      ? `app/${groupFolder}/_components/${headerCompName}.tsx`
      : `app/${groupFolder}/${pageMeta.slug}/_components/${headerCompName}.tsx`;

    files.push({
      filename: headerFilePath,
      language: "typescript",
      content: generatePageHeaderComponent(pageMeta),
    });

    const pageCode = generatePageCode(
      pageMeta,
      pageLoadFetchStatements,
      eventComponentsMeta,
    );

    const targetFilePath = pageMeta.isRoot
      ? `app/${groupFolder}/page.tsx`
      : `app/${groupFolder}/${pageMeta.slug}/page.tsx`;

    files.push({
      filename: targetFilePath,
      language: "typescript",
      content: pageCode,
    });
  });

  if (!hasExplicitRoot) {
    const indexCards = pagesInfo
      .map(
        (p) => `
          <Link href="${p.routePath}" className="block bg-card text-card-foreground border border-border hover:border-primary/50 rounded-xl p-6 transition-all hover:shadow-lg group">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-card-foreground group-hover:text-primary transition-colors">${p.label}</h2>
              <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground font-mono">${p.routePath}</span>
            </div>
            <p className="text-muted-foreground text-sm mb-4">${p.description || "Interactive Next.js page"}</p>
            <div className="flex items-center text-xs text-primary font-semibold group-hover:translate-x-1 transition-transform">
              Open Page &rarr;
            </div>
          </Link>`,
      )
      .join("\n");

    files.push({
      filename: "app/(public)/_components/WebClientIndexHeader.tsx",
      language: "typescript",
      content: generateRootIndexHeaderComponent(projectName),
    });

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
