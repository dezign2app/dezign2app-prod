import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, UIEventItem, CompiledFile } from "@workspace/canvas/types";
import { PageInfo } from "./types";
import { resolveLinkedEndpoint, resolvePageRefLink } from "./endpointResolver";
import { labelToSlug, slugToComponentName } from "./slugUtils";
import {
  generateEventComponent,
  generatePageHeaderComponent,
  generateRootIndexHeaderComponent,
  generatePageCode,
  generateAuthFormComponent,
  generateRootIndexPage,
  EventComponentMeta,
} from "./componentTemplates";
import { isAuthPage } from "../../../compileAuth";

export interface GeneratePageAndComponentFilesParams {
  webClientNodes: BackendNode[];
  pagesInfo: PageInfo[];
  endpoints?: (Endpoint & { nodeId: string })[];
  allNodes?: BackendNode[];
  allEdges?: BackendEdge[];
  authNode?: BackendNode;
}

export interface PageAndComponentFilesResult {
  pageFiles: CompiledFile[];
  hasExplicitRoot: boolean;
}

/**
 * Generates page load fetch statements, event components, headers, auth components, and page files
 */
export function generatePageAndComponentFiles({
  webClientNodes,
  pagesInfo,
  endpoints = [],
  allNodes = [],
  allEdges = [],
  authNode,
}: GeneratePageAndComponentFilesParams): PageAndComponentFilesResult {
  const pageFiles: CompiledFile[] = [];
  let hasExplicitRoot = false;

  webClientNodes.forEach((node, idx) => {
    const pageMeta = pagesInfo[idx]!;
    if (pageMeta.isRoot) {
      hasExplicitRoot = true;
    }

    const nodeHeaders: Record<string, string> = {};
    (node.data?.headers || []).forEach((h: any) => {
      const hKey = h.key || h.name;
      const hVal = h.value || h.defaultValue || "";
      if (hKey) {
        nodeHeaders[hKey] = hVal;
      }
    });

    const nodeQueryParams: Record<string, string> = {};
    (node.data?.queryParams || []).forEach((p: any) => {
      const pKey = p.key || p.name;
      const pVal = p.value || p.defaultValue || "";
      if (pKey) {
        nodeQueryParams[pKey] = pVal;
      }
    });

    let nodeRequestBody: unknown = undefined;
    if (node.data?.requestBody?.rawJson) {
      try {
        nodeRequestBody = JSON.parse(node.data.requestBody.rawJson);
      } catch {}
    } else if (node.data?.requestBody?.fields && node.data.requestBody.fields.length > 0) {
      const bodyObj: Record<string, any> = {};
      node.data.requestBody.fields.forEach((f: any) => {
        const fKey = f.name || f.key;
        if (fKey) {
          bodyObj[fKey] = f.value ?? f.defaultValue ?? (f.type === "number" ? 0 : f.type === "boolean" ? true : `sample_${fKey}`);
        }
      });
      nodeRequestBody = bodyObj;
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
          const requireAuth = link.requireAuth !== false;
          const headersEntries = Object.entries(nodeHeaders)
            .map(([k, v]) => `"${k}": "${v}",`)
            .join("\n          ");

          statements.push(`const headers_${link.targetNodeId}: Record<string, string> = {
          "Content-Type": "application/json",
          ${headersEntries}
        };
        ${requireAuth ? `const token_${link.targetNodeId} = await getAuthBearerToken();
        if (token_${link.targetNodeId}) {
          headers_${link.targetNodeId}["Authorization"] = token_${link.targetNodeId};
        }` : ""}
        const res_${link.targetNodeId} = await fetch("${link.fullUrl}", {
          method: "${link.method || "GET"}",
          headers: headers_${link.targetNodeId},
          ${link.method === "POST" || link.method === "PUT" || link.method === "PATCH" ? `body: JSON.stringify(${nodeRequestBody !== undefined ? JSON.stringify(nodeRequestBody) : `{ eventName: "${evt.name || "pageLoad"}", eventType: "pageLoad" }`}),` : ""}
        });
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
      const evtName = evt.name || `Action ${evtIdx + 1}`;
      const evtType = evt.event || "click";
      const compName = slugToComponentName(labelToSlug(evtName, evtIdx)).replace(/Page$/, "Action");

      let url = "";
      let method = "POST";
      let targetRoute: string | undefined = undefined;
      let targetPageLabel: string | undefined = undefined;
      let requireAuth = true;
      let link: ReturnType<typeof resolveLinkedEndpoint> = null;

      if (evtType === "navigateToPage") {
        const pageRefLink = resolvePageRefLink(
          node.id,
          evt.id,
          allNodes,
          allEdges,
          evt.targetPageId,
          evt.targetRoute,
        );
        targetRoute = pageRefLink.targetRoute;
        targetPageLabel = pageRefLink.targetNodeName;
      } else {
        link = resolveLinkedEndpoint(
          node.id,
          evt.id,
          allNodes,
          allEdges,
          endpoints,
        );
        url = link ? link.fullUrl : "";
        method = link ? link.method : "POST";
        requireAuth = link ? link.requireAuth !== false : true;
      }

      eventComponentsMeta.push({
        componentName: compName,
        eventName: evtName,
        eventType: evtType,
        url,
        method,
        targetRoute,
        targetPageLabel,
        requireAuth,
        customHeaders: Object.keys(nodeHeaders).length > 0 ? nodeHeaders : undefined,
        queryParams: Object.keys(nodeQueryParams).length > 0 ? nodeQueryParams : undefined,
        requestBody: nodeRequestBody,
        eventItem: evt,
        endpoint: link?.endpoint,
      });

      const groupFolder = pageMeta.routeGroup ? `(${pageMeta.routeGroup})` : "(public)";
      const componentFilePath = pageMeta.isRoot
        ? `app/${groupFolder}/_components/${compName}.tsx`
        : `app/${groupFolder}/${pageMeta.slug}/_components/${compName}.tsx`;

      pageFiles.push({
        filename: componentFilePath,
        language: "typescript",
        content: generateEventComponent(
          evtName,
          evtType,
          url,
          method,
          compName,
          targetRoute,
          targetPageLabel,
          requireAuth,
          Object.keys(nodeHeaders).length > 0 ? nodeHeaders : undefined,
          Object.keys(nodeQueryParams).length > 0 ? nodeQueryParams : undefined,
          nodeRequestBody,
          evt,
          link?.endpoint,
        ),
      });
    });

    const groupFolder = pageMeta.routeGroup ? `(${pageMeta.routeGroup})` : "(public)";
    const headerCompName = `${pageMeta.componentName}Header`;
    const headerFilePath = pageMeta.isRoot
      ? `app/${groupFolder}/_components/${headerCompName}.tsx`
      : `app/${groupFolder}/${pageMeta.slug}/_components/${headerCompName}.tsx`;

    pageFiles.push({
      filename: headerFilePath,
      language: "typescript",
      content: generatePageHeaderComponent(pageMeta),
    });

    const effectiveAuthNode =
      authNode ||
      allNodes.find(
        (n) => n.type === "auth" || (node.data?.authNodeId && n.id === node.data.authNodeId)
      );

    const isAuth = isAuthPage(pageMeta, effectiveAuthNode?.data);
    if (isAuth) {
      const baseName = pageMeta.componentName.replace(/Page$/, "");
      const formCompName = baseName.endsWith("Form") ? baseName : `${baseName}Form`;
      const formFilePath = pageMeta.isRoot
        ? `app/${groupFolder}/_components/${formCompName}.tsx`
        : `app/${groupFolder}/${pageMeta.slug}/_components/${formCompName}.tsx`;

      pageFiles.push({
        filename: formFilePath,
        language: "typescript",
        content: generateAuthFormComponent(pageMeta, effectiveAuthNode?.data),
      });
    }

    const pageCode = generatePageCode(
      pageMeta,
      pageLoadFetchStatements,
      eventComponentsMeta,
      effectiveAuthNode?.data,
    );

    const targetFilePath = pageMeta.isRoot
      ? `app/${groupFolder}/page.tsx`
      : `app/${groupFolder}/${pageMeta.slug}/page.tsx`;

    pageFiles.push({
      filename: targetFilePath,
      language: "typescript",
      content: pageCode,
    });
  });

  return { pageFiles, hasExplicitRoot };
}

/**
 * Generates fallback root index components and page if canvas lacks an explicit root node
 */
export function generateFallbackRootIndex(
  projectName: string,
  pagesInfo: PageInfo[],
): CompiledFile[] {
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

  return [
    {
      filename: "app/(public)/_components/WebClientIndexHeader.tsx",
      language: "typescript",
      content: generateRootIndexHeaderComponent(projectName),
    },
    {
      filename: "app/(public)/page.tsx",
      language: "typescript",
      content: generateRootIndexPage(projectName, indexCards),
    },
  ];
}
