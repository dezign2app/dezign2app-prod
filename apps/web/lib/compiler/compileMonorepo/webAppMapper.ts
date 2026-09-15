// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  webAppMapper
// LAYER:   resolvers
// PURPOSE: Resolves the mapping from WebPage nodes → WebApp buckets by
//          tracing canvas edge handles to their access-zone type.
//
// ACCESS-TYPE DISPATCH TABLE (handle prefix → routeGroup / accessType):
// ┌──────────────────────────┬──────────────────┬───────────────────┐
// │ Handle prefix / zone     │ routeGroup       │ accessTypeOverride│
// ├──────────────────────────┼──────────────────┼───────────────────┤
// │ public-in / "public"     │ "public"         │ "public"          │
// │ private-in / "private"   │ "private"        │ "private"         │
// │ role-in / "role"         │ "role-gated"     │ "role-gated"      │
// │ payment-in / "payment"   │ "payment-gated"  │ "payment-gated"   │
// │ org-in / "org"           │ "org-gated"      │ "org-gated"       │
// │ matchedZone.accessType   │ zone slug        │ "private"         │
// │ (unrecognised handle)    │ cleaned handle   │ (not set)         │
// └──────────────────────────┴──────────────────┴───────────────────┘
// ═══════════════════════════════════════════════════════════════════════════

import { BackendNode, BackendEdge } from "@/types/canvas";

/** A single web-app compilation bucket, holding all its page nodes. */
export interface WebAppEntry {
  appName: string;
  appSlug: string;
  /** The canvas WebApp node, if one was explicitly placed. */
  webAppNode?: BackendNode;
  /** All WebPage nodes that belong to this app, enriched with routing metadata. */
  pageNodes: BackendNode[];
}

/**
 * Resolves the relationship between WebPage nodes and their parent WebApp
 * nodes by tracing canvas edges and reading handle IDs.
 *
 * Steps:
 *  1. Build an `appMap` entry for every explicit WebApp node.
 *  2. For each WebPage node, find the edge connecting it to a WebApp node
 *     and determine the access zone from the edge's handle ID.
 *  3. Enrich the page node with routing metadata and push it into the correct
 *     `appMap` bucket.
 *
 * @param webAppNodes  - All "webApp" type nodes.
 * @param webPageNodes - All "webPage" type nodes.
 * @param edges        - All canvas edges.
 * @returns            - Map keyed by appSlug → {@link WebAppEntry}.
 *
 * @debugTag web-app-mapper-step-6
 */
export function buildWebAppMap(
  webAppNodes: BackendNode[],
  webPageNodes: BackendNode[],
  edges: BackendEdge[],
): Map<string, WebAppEntry> {
  const appMap = new Map<string, WebAppEntry>();

  // ── 1. Register explicit WebApp nodes ────────────────────────────────────
  webAppNodes.forEach((appNode) => {
    const appName = appNode.data?.label || "Web Application";
    const baseSlug =
      appNode.data?.appSlug?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
      appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
      "web-app";

    // Deduplicate slugs if multiple WebApp nodes have the same label
    let appSlug = baseSlug;
    let counter = 1;
    while (appMap.has(appSlug)) {
      counter++;
      appSlug = `${baseSlug}-${counter}`;
    }

    appMap.set(appSlug, {
      appName,
      appSlug,
      webAppNode: appNode,
      pageNodes: [],
    });
  });

  // ── 2. Route each WebPage node into its WebApp bucket ────────────────────
  webPageNodes.forEach((pageNode) => {
    // Find the edge that connects this page to any WebApp node (either direction)
    const edgeToApp = edges.find(
      (e) =>
        (e.source === pageNode.id && webAppNodes.some((appNode) => appNode.id === e.target)) ||
        (e.target === pageNode.id && webAppNodes.some((appNode) => appNode.id === e.source)),
    );

    let targetAppSlug: string | undefined;
    let routeGroup = "public";
    let accessTypeOverride:
      | "public"
      | "private"
      | "role-gated"
      | "payment-gated"
      | "org-gated"
      | undefined;

    if (edgeToApp) {
      // Resolve the target WebApp node id
      const targetAppId =
        edgeToApp.source === pageNode.id ? edgeToApp.target : edgeToApp.source;
      const targetAppNode = webAppNodes.find((n) => n.id === targetAppId);

      if (targetAppNode) {
        // Resolve the canonical slug that was registered in step 1
        targetAppSlug =
          targetAppNode.data?.appSlug?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
          (targetAppNode.data?.label || "web-app")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") ||
          "web-app";

        // ── Access-zone resolution from edge handle ───────────────────────
        // The handle encodes which "zone" of the WebApp the page connects to.
        const handle =
          (edgeToApp.source === pageNode.id
            ? edgeToApp.targetHandle
            : edgeToApp.sourceHandle) || "";
        const zones = targetAppNode.data?.zones || [];
        const matchedZone = zones.find(
          (z: { handleId: string; name?: string; accessType?: string }) =>
            z.handleId === handle,
        );

        if (matchedZone) {
          // ── Zone-object based dispatch ──────────────────────────────────
          if (
            matchedZone.accessType === "public" ||
            handle.startsWith("public-in") ||
            handle.includes("public")
          ) {
            routeGroup = "public";
            accessTypeOverride = "public";
          } else if (
            matchedZone.accessType === "protected" ||
            handle.startsWith("private-in") ||
            handle.includes("private")
          ) {
            routeGroup = "private";
            accessTypeOverride = "private";
          } else {
            // Custom access zone: use the zone name as the route group slug
            const zoneSlug = (matchedZone.name || "custom")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
            routeGroup = zoneSlug || "custom";
            accessTypeOverride = "private";
          }
        } else {
          // ── Handle-prefix based dispatch (no matching zone object) ──────
          if (handle.startsWith("public-in") || handle.includes("public")) {
            routeGroup = "public";
            accessTypeOverride = "public";
          } else if (handle.startsWith("private-in") || handle.includes("private")) {
            routeGroup = "private";
            accessTypeOverride = "private";
          } else if (handle.startsWith("role-in") || handle.includes("role")) {
            routeGroup = "role-gated";
            accessTypeOverride = "role-gated";
          } else if (handle.startsWith("payment-in") || handle.includes("payment")) {
            routeGroup = "payment-gated";
            accessTypeOverride = "payment-gated";
          } else if (handle.startsWith("org-in") || handle.includes("org")) {
            routeGroup = "org-gated";
            accessTypeOverride = "org-gated";
          } else {
            // Unrecognised handle — derive a route-group name from the handle string
            const cleanHandle = handle
              .replace(/-(in|out)$/, "")
              .replace(/^zone-/, "");
            routeGroup = cleanHandle
              ? cleanHandle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
              : "public";
          }
        }
      }
    } else if (webAppNodes.length === 0) {
      // ── Fallback: no WebApp nodes on canvas, infer from pageNode.data ───
      const isConnected = edges.some(
        (e) => e.source === pageNode.id || e.target === pageNode.id,
      );
      if (isConnected && pageNode.data?.appSlug) {
        const candidateSlug = pageNode.data.appSlug
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (!appMap.has(candidateSlug)) {
          appMap.set(candidateSlug, {
            appName: pageNode.data?.appName || candidateSlug,
            appSlug: candidateSlug,
            pageNodes: [],
          });
        }
        targetAppSlug = candidateSlug;
        routeGroup =
          pageNode.data?.routeGroup ||
          (pageNode.data?.accessType && pageNode.data?.accessType !== "public"
            ? "private"
            : "public");
      }
    }

    // Discard pages that couldn't be matched to any WebApp bucket
    if (!targetAppSlug || !appMap.has(targetAppSlug)) {
      return;
    }

    const targetAppObj = appMap.get(targetAppSlug)!;
    const appNodeData = targetAppObj.webAppNode?.data;

    // ── 3. Enrich page node with routing metadata ─────────────────────────
    const enrichedPageNode: BackendNode = {
      ...pageNode,
      data: {
        ...pageNode.data,
        appSlug: targetAppSlug,
        appName: targetAppObj.appName,
        routeGroup,
        accessType: accessTypeOverride || pageNode.data?.accessType || "public",
        // Inherit auth config from the parent WebApp node if not set on the page
        allowedRoles: pageNode.data?.allowedRoles || appNodeData?.allowedRoles,
        requiredPlans: pageNode.data?.requiredPlans || appNodeData?.requiredPlans,
        allowedOrgRoles: pageNode.data?.allowedOrgRoles || appNodeData?.allowedOrgRoles,
        authNodeId: pageNode.data?.authNodeId || appNodeData?.authNodeId,
      },
    };

    targetAppObj.pageNodes.push(enrichedPageNode);
  });

  return appMap;
}
