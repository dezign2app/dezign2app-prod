import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import { CompiledFile, CompiledServiceResult, Endpoint, AnyMessagingResource, AuthPageMetaInfo } from "@workspace/canvas/types";
import {
  DEFAULT_AUTH_FRAMEWORK,
  DEFAULT_BETTER_AUTH_VERSION,
  AUTH_FRAMEWORK_BETTER_AUTH,
  BackendNodeData,
} from "@workspace/canvas";
import { compileBetterAuthV16 } from "./auth/better-auth/v1.6";

export type { AuthPageMetaInfo };

export interface CompiledAuthResult {
  authNodeId: string;
  serviceId?: string;
  serviceName?: string;
  files: CompiledFile[];
}

/**
 * Resolves database nodes connected to an Auth node via graph edges
 */
export function resolveConnectedDbNodes(
  authNode: BackendNode,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = []
): BackendNode[] {
  const connectedNodeIds = new Set<string>();

  allEdges.forEach((edge) => {
    if (edge.source === authNode.id) {
      connectedNodeIds.add(edge.target);
    } else if (edge.target === authNode.id) {
      connectedNodeIds.add(edge.source);
    }
  });

  const connectedDbNodes = allNodes.filter((n) => {
    if (!connectedNodeIds.has(n.id)) return false;
    const t = String(n.type).toLowerCase();
    return t === "entity" || t === "db_ref" || t === "db" || t === "database";
  });

  if (connectedDbNodes.length > 0) {
    return connectedDbNodes;
  }

  // Fallback: Return all DB nodes in canvas if available
  return allNodes.filter((n) => {
    const t = String(n.type).toLowerCase();
    return t === "entity" || t === "db_ref" || t === "db" || t === "database";
  });
}

/**
 * Resolves accessible target nodes (web apps, pages, services) protected by or connected to an Auth node
 */
export function resolveAccessibleNodes(
  authNode: BackendNode,
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = []
): BackendNode[] {
  const accessibleNodeIds = new Set<string>();

  allEdges.forEach((edge) => {
    if (edge.source === authNode.id) {
      accessibleNodeIds.add(edge.target);
    } else if (edge.target === authNode.id) {
      accessibleNodeIds.add(edge.source);
    }
  });

  return allNodes.filter((n) => {
    if (!accessibleNodeIds.has(n.id)) return false;
    const t = String(n.type).toLowerCase();
    return t === "webclient" || t === "webapp" || t === "service" || Boolean(n.data?.isWebClient);
  });
}

/**
 * Compiles a Canvas Auth Node into code based on the selected framework type (e.g. better_auth) and version (e.g. v1.6).
 * Auth is compiled as an integrated monorepo security component (Better Auth configuration, Next.js handler,
 * client SDK, FastAPI middleware, and environment variables) rather than an independent standalone app.
 */
export function compileAuth(
  node: BackendNode,
  _endpoints: (Endpoint & { nodeId: string })[] = [],
  _events: (AnyMessagingResource & {
    nodeId: string;
    variant: "publish" | "consume";
  })[] = [],
  allNodes: BackendNode[] = [],
  allEdges: BackendEdge[] = [],
  _testCases: SimulationTestCase[] = []
): CompiledAuthResult {
  const framework = node.data?.framework || DEFAULT_AUTH_FRAMEWORK;
  const _version = node.data?.version || DEFAULT_BETTER_AUTH_VERSION;

  switch (framework) {
    case AUTH_FRAMEWORK_BETTER_AUTH:
    case "better_auth":
    default: {
      return compileBetterAuthV16(node, allNodes, allEdges);
    }
  }
}

/**
 * Checks whether a page is the Sign-In / Login page as defined in AuthConfig (redirects) or by fallback conventions
 */
export function isAuthLoginPage(
  pageMeta: AuthPageMetaInfo,
  authNodeData?: BackendNodeData
): boolean {
  const redirects = authNodeData?.redirects;
  const hasConfiguredSignIn = Boolean(redirects?.signInPageNodeId || redirects?.signInPageUrl);

  if (redirects?.signInPageNodeId && pageMeta.nodeId === redirects.signInPageNodeId) {
    return true;
  }

  const configuredSignInUrl = redirects?.signInPageUrl;
  if (configuredSignInUrl) {
    const cleanSignIn = configuredSignInUrl.startsWith("/") ? configuredSignInUrl : `/${configuredSignInUrl}`;
    const cleanRoutePath = pageMeta.routePath?.startsWith("/") ? pageMeta.routePath : `/${pageMeta.routePath || ""}`;
    const cleanSlug = pageMeta.slug ? `/${pageMeta.slug}` : "";
    if (cleanRoutePath === cleanSignIn || cleanSlug === cleanSignIn) {
      return true;
    }
  }

  // If a specific sign-in page was configured in AuthConfig, do not match other non-configured pages
  if (hasConfiguredSignIn) {
    return false;
  }

  const slug = (pageMeta.slug || "").toLowerCase();
  const route = (pageMeta.routePath || "").toLowerCase();
  return slug === "login" || slug === "signin" || route === "/login" || route === "/signin";
}

/**
 * Checks whether a page is the Sign-Up / Register page as defined in AuthConfig (redirects) or by fallback conventions
 */
export function isAuthRegisterPage(
  pageMeta: AuthPageMetaInfo,
  authNodeData?: BackendNodeData
): boolean {
  const redirects = authNodeData?.redirects;
  const hasConfiguredSignUp = Boolean(redirects?.signUpPageNodeId || redirects?.signUpPageUrl);

  if (redirects?.signUpPageNodeId && pageMeta.nodeId === redirects.signUpPageNodeId) {
    return true;
  }

  const configuredSignUpUrl = redirects?.signUpPageUrl;
  if (configuredSignUpUrl) {
    const cleanSignUp = configuredSignUpUrl.startsWith("/") ? configuredSignUpUrl : `/${configuredSignUpUrl}`;
    const cleanRoutePath = pageMeta.routePath?.startsWith("/") ? pageMeta.routePath : `/${pageMeta.routePath || ""}`;
    const cleanSlug = pageMeta.slug ? `/${pageMeta.slug}` : "";
    if (cleanRoutePath === cleanSignUp || cleanSlug === cleanSignUp) {
      return true;
    }
  }

  // If a specific sign-up page was configured in AuthConfig, do not match other non-configured pages
  if (hasConfiguredSignUp) {
    return false;
  }

  const slug = (pageMeta.slug || "").toLowerCase();
  const route = (pageMeta.routePath || "").toLowerCase();
  return slug === "register" || slug === "signup" || route === "/register" || route === "/signup";
}

/**
 * Checks whether a page is any auth page (login or register page)
 */
export function isAuthPage(
  pageMeta: AuthPageMetaInfo,
  authNodeData?: BackendNodeData
): boolean {
  if (pageMeta.isAuthPage) return true;
  return isAuthLoginPage(pageMeta, authNodeData) || isAuthRegisterPage(pageMeta, authNodeData);
}

/**
 * Determines whether social authentication providers should be generated for a page.
 * Social providers are ONLY generated for the login and register pages defined in AuthConfig.
 */
export function shouldGenerateSocialProviders(
  pageMeta: AuthPageMetaInfo,
  authNodeData?: BackendNodeData
): boolean {
  const isTargetAuthPage = isAuthLoginPage(pageMeta, authNodeData) || isAuthRegisterPage(pageMeta, authNodeData);
  if (!isTargetAuthPage) {
    return false;
  }

  const providers = authNodeData?.providers || {};
  const isSocialEnabled =
    providers.socialEnabled ??
    providers.oauthEnabled ??
    (authNodeData?.providers ? Boolean(providers.oauth && providers.oauth.length > 0) : true);

  return isSocialEnabled;
}
