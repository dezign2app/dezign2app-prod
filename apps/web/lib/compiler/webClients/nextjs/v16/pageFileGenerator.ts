import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, UIEventItem, PageSection, CompiledFile } from "@workspace/canvas/types";
import { PageInfo } from "./types";
import { resolveLinkedEndpoint, resolvePageRefLink } from "./endpointResolver";
import { labelToSlug, slugToComponentName } from "./slugUtils";
import {
  generateEventComponent,
  generateSectionComponent,
  generateRootIndexHeaderComponent,
  generatePageCode,
  generateAuthFormComponent,
  generateRootIndexPage,
  EventComponentMeta,
  SectionMeta,
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

    const effectiveAuthNode =
      authNode ||
      (node.data?.authNodeId
        ? allNodes.find((n) => n.id === node.data.authNodeId && n.type === "auth")
        : undefined);

    const nodeHeaders: Record<string, string> = {};
    (node.data?.headers || []).forEach((h) => {
      const hKey = h.key || h.name;
      const hVal = h.value || h.defaultValue || "";
      if (hKey) {
        nodeHeaders[hKey] = hVal;
      }
    });

    const nodeQueryParams: Record<string, string> = {};
    (node.data?.queryParams || []).forEach((p) => {
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
      const bodyObj: Record<string, unknown> = {};
      node.data.requestBody.fields.forEach((f) => {
        const fKey = f.name || f.key;
        if (fKey) {
          bodyObj[fKey] = f.value ?? f.defaultValue ?? (f.type === "number" ? 0 : f.type === "boolean" ? true : `sample_${fKey}`);
        }
      });
      nodeRequestBody = bodyObj;
    }

    const rawSections: PageSection[] = node.data?.sections || [];
    const normalizedSections: PageSection[] =
      rawSections.length > 0
        ? rawSections
        : node.data?.events && node.data.events.length > 0
        ? [
            {
              id: "sec-default",
              name: "Main Section",
              renderMode: "server",
              loadStrategy: "eager",
              actions: node.data.events,
            },
          ]
        : [
            {
              id: "sec-default",
              name: "Main Section",
              renderMode: "server",
              loadStrategy: "eager",
              actions: [],
            },
          ];

    const allActions: UIEventItem[] = normalizedSections.flatMap((s) => s.actions || []);
    const pageLoadEvents = allActions.filter(
      (e) => (e.event as string) === "pageLoad" || e.name === "pageLoad",
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
          const requireAuth = Boolean(effectiveAuthNode) && link.requireAuth !== false;
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
        const results: Record<string, unknown> = {};
        ${statements.join("\n")}
        setPageLoadData(${pageLoadEvents.length === 1} ? results["${pageLoadEvents[0]?.name || "pageLoad"}"] : results);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load page data";
        setPageLoadError(message);
      } finally {
        setPageLoadLoading(false);
      }`;
    }

    const groupFolder = pageMeta.routeGroup ? `(${pageMeta.routeGroup})` : "(public)";
    const baseComponentsDir = pageMeta.isRoot
      ? `app/${groupFolder}/_components`
      : `app/${groupFolder}/${pageMeta.slug}/_components`;

    const sectionsMeta: SectionMeta[] = [];

    normalizedSections.forEach((sec, secIdx) => {
      const secName = sec.name || `Section ${secIdx + 1}`;
      const secFolder = labelToSlug(secName, secIdx);
      const baseComp = slugToComponentName(secFolder).replace(/Page$/, "");
      const secCompName = baseComp.endsWith("Section") ? baseComp : `${baseComp}Section`;
      const sectionDir = `${baseComponentsDir}/${secFolder}`;

      const secActionMetas: EventComponentMeta[] = [];
      const nonPageLoadActions = (sec.actions || []).filter(
        (e) => (e.event as string) !== "pageLoad" && e.name !== "pageLoad",
      );

      nonPageLoadActions.forEach((evt, evtIdx) => {
        const evtName = evt.name || `Action ${evtIdx + 1}`;
        const evtType = evt.event || "click";
        const compName = slugToComponentName(labelToSlug(evtName, evtIdx)).replace(/Page$/, "Action");

        let url = "";
        let method = "POST";
        let targetRoute: string | undefined = undefined;
        let targetPageLabel: string | undefined = undefined;
        let requireAuth = Boolean(effectiveAuthNode);
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
          requireAuth = Boolean(effectiveAuthNode) && (link ? link.requireAuth !== false : true);
        }

        const actionMeta: EventComponentMeta = {
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
        };
        secActionMetas.push(actionMeta);

        // Action component file INSIDE section folder under _components
        const componentFilePath = `${sectionDir}/${compName}.tsx`;
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

      // Section component file INSIDE section folder under _components
      const sectionFilePath = `${sectionDir}/${secCompName}.tsx`;
      pageFiles.push({
        filename: sectionFilePath,
        language: "typescript",
        content: generateSectionComponent(sec, secCompName, secActionMetas),
      });

      // Section index file re-exporting the section component
      pageFiles.push({
        filename: `${sectionDir}/index.ts`,
        language: "typescript",
        content: `export * from "./${secCompName}";\nexport { default } from "./${secCompName}";\n`,
      });

      sectionsMeta.push({
        id: sec.id,
        name: secName,
        folderName: secFolder,
        componentName: secCompName,
        renderMode: sec.renderMode,
        actions: secActionMetas,
      });
    });

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
      sectionsMeta,
      effectiveAuthNode?.data,
    );

    const targetFilePath = pageMeta.isRoot
      ? `app/${groupFolder}/page.tsx`
      : `app/${groupFolder}/${pageMeta.slug}/page.tsx`;

    // If the node has AI-edited page source code, use it directly.
    // This prevents compiler re-runs from overwriting UI edits made via
    // the page visual editor. The AI-edited content is stored in Convex
    // and syncs to all collaborators automatically.
    const finalPageContent = node.data?.pageSourceCode
      ? (node.data.pageSourceCode as string)
      : pageCode;

    pageFiles.push({
      filename: targetFilePath,
      language: "typescript",
      content: finalPageContent,
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
