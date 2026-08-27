import { BackendNode, BackendEdge } from "@/types/canvas";
import { WebAppZone, ConditionNode } from "@workspace/canvas";
import { PageInfo } from "./types";
import { labelToSlug, slugToComponentName } from "./slugUtils";

/**
 * Resolves WebClient nodes and WebApp zone configurations into PageInfo metadata
 */
export function resolvePagesInfo(
  webClientNodes: BackendNode[],
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  effectiveAppSlug: string = "web-app",
  webAppNode?: BackendNode,
  authNode?: BackendNode,
): PageInfo[] {
  const pagesInfo: PageInfo[] = [];
  const usedSlugs = new Set<string>();

  const targetWebAppNode =
    webAppNode ||
    allNodes.find(
      (n) =>
        n.type === "webApp" &&
        (n.data?.appSlug?.toLowerCase().replace(/[^a-z0-9]+/g, "-") === effectiveAppSlug ||
          n.data?.label?.toLowerCase().replace(/[^a-z0-9]+/g, "-") === effectiveAppSlug),
    ) ||
    allNodes.find((n) => n.type === "webApp");

  const defaultSignInPage = authNode?.data?.redirects?.signInPageUrl || "/login";

  const defaultZones: WebAppZone[] = [
    {
      id: "zone-public",
      name: "Public Section",
      handleId: "public-in",
      accessType: "public",
      rule: {
        id: "rule-public",
        scope: "zone",
        conditions: { kind: "leaf", condition: { type: "auth", op: "signedOut" } },
        redirects: { default: defaultSignInPage },
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
        redirects: { "no-auth": defaultSignInPage, default: defaultSignInPage },
      },
    },
  ];

  const appZones: WebAppZone[] =
    targetWebAppNode && Array.isArray(targetWebAppNode.data?.zones) && targetWebAppNode.data.zones.length > 0
      ? targetWebAppNode.data.zones
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
      cleanLabel === "/";
    const routePath = isRoot ? "/" : `/${slug}`;
    const componentName = isRoot ? "HomePage" : slugToComponentName(slug);

    // Find edge connecting a webApp node handle to this webClient node handle
    const connectedEdge = allEdges.find((e) => {
      const isTarget = e.target === node.id;
      const isSource = e.source === node.id;
      if (!isTarget && !isSource) return false;
      const otherId = isSource ? e.target : e.source;
      return targetWebAppNode ? otherId === targetWebAppNode.id : allNodes.some((n) => n.id === otherId && n.type === "webApp");
    });

    let matchedZone: WebAppZone | undefined = undefined;
    if (connectedEdge && targetWebAppNode) {
      const sectionHandleId =
        connectedEdge.source === targetWebAppNode.id
          ? connectedEdge.sourceHandle
          : connectedEdge.targetHandle;
      matchedZone = appZones.find((z) => z.handleId === sectionHandleId);
    }

    if (!matchedZone && node.data.zoneId) {
      matchedZone = appZones.find((z) => z.id === node.data.zoneId);
    }

    let accessType: "public" | "private" | "role-gated" | "payment-gated" | "org-gated" = "public";
    let redirectTo = node.data.redirectTo || defaultSignInPage;
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
            defaultSignInPage;
        }

        if (matchedZone.rule?.conditions) {
          const extractConditions = (condNode: ConditionNode | undefined): void => {
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

  return pagesInfo;
}
