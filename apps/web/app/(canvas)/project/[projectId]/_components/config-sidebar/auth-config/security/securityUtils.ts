import { BackendNode } from "@/types/canvas";
import { labelToSlug } from "@/lib/compiler/webClients/nextjs/v16/slugUtils";
import { ConfiguredPage } from "./types";

export const getConfiguredPages = (allNodes: BackendNode[]): ConfiguredPage[] => {
  const pagesList: ConfiguredPage[] = [];
  const seenPaths = new Set<string>();

  // 1. WebPage nodes from Canvas
  const webPageNodes = (allNodes || []).filter((n) => n.type === "webPage");

  webPageNodes.forEach((node, idx) => {
    const rawLabel = node.data?.label || `Page ${idx + 1}`;
    const cleanLabel = rawLabel.trim().toLowerCase();
    let path: string | undefined = node.data?.path || node.data?.pageSlug || node.data?.route;
    if (!path || cleanLabel === "/") {
      const slug = cleanLabel === "/" ? "home" : labelToSlug(rawLabel, idx);
      path = slug === "home" ? "/" : `/${slug}`;
    }
    if (!path.startsWith("/")) path = `/${path}`;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

    pagesList.push({
      id: node.id,
      path,
      label: rawLabel,
      isCanvasPage: true,
    });
    seenPaths.add(path);
  });

  // 2. WebApp node routes
  const webAppNode = (allNodes || []).find((n) => n.type === "webApp");
  if (webAppNode?.data?.routes && Array.isArray(webAppNode.data.routes)) {
    webAppNode.data.routes.forEach((r, idx) => {
      if (r.path) {
        const p = r.path.startsWith("/") ? r.path : `/${r.path}`;
        const id = r.id || `webapp-route-${idx}`;
        if (!seenPaths.has(p)) {
          pagesList.push({
            id,
            path: p,
            label: r.name || p,
            isCanvasPage: true,
          });
          seenPaths.add(p);
        }
      }
    });
  }

  return pagesList;
};
