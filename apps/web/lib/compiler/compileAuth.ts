import { BackendNode, BackendEdge, SimulationTestCase } from "@/types/canvas";
import { CompiledServiceResult, Endpoint, AnyMessagingResource } from "@workspace/canvas/types";
import {
  DEFAULT_AUTH_FRAMEWORK,
  DEFAULT_BETTER_AUTH_VERSION,
  AUTH_FRAMEWORK_BETTER_AUTH,
} from "@workspace/canvas";
import { compileBetterAuthV16Service } from "./auth/better-auth/v1.6";

/**
 * Compiles a Canvas Auth Node into code based on the selected framework type (e.g. better_auth) and version (e.g. v1.6)
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
): CompiledServiceResult {
  const framework = node.data?.framework || DEFAULT_AUTH_FRAMEWORK;
  const _version = node.data?.version || DEFAULT_BETTER_AUTH_VERSION;

  switch (framework) {
    case AUTH_FRAMEWORK_BETTER_AUTH:
    case "better_auth":
    default: {
      return compileBetterAuthV16Service(node, allNodes, allEdges);
    }
  }
}

export interface AuthPageMetaInfo {
  nodeId?: string;
  slug?: string;
  routePath?: string;
  isAuthPage?: boolean;
}

/**
 * Checks whether a page is the Sign-In / Login page as defined in AuthConfig (redirects) or by fallback conventions
 */
export function isAuthLoginPage(
  pageMeta: AuthPageMetaInfo,
  authNodeData?: Record<string, any>
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
  authNodeData?: Record<string, any>
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
  authNodeData?: Record<string, any>
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
  authNodeData?: Record<string, any>
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

export { compileAuth as compileAuthNodeRunner };

