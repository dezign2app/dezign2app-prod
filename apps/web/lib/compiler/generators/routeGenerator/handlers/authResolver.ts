// ═══════════════════════════════════════════════════════════════
// MODULE: AuthResolver
// LAYER:  generators / routeGenerator / handlers
// EMITS:  auth metadata (requiresAuth, authOptions) for route registration
// ═══════════════════════════════════════════════════════════════

import { Endpoint, EndpointTraceResult } from "@workspace/canvas/types";

export interface AuthResolutionResult {
  /** Whether this endpoint requires authentication. */
  requiresAuth: boolean;
  /** JSON-serialized options object string, e.g. '{}' or '{"roles":["admin"]}'. Always valid JSON. */
  authOptions: string;
}

/**
 * Compute per-endpoint auth requirements — surfaced on the return value so the
 * router builder can inject requireAuth() at the registration site, not inline.
 */
export function resolveEndpointAuth(
  ep: Endpoint & { nodeId: string },
  trace: EndpointTraceResult,
): AuthResolutionResult {
  const isCallerProtected = trace.incoming.some((inc) => inc.isProtected);
  const requiresAuth =
    ep.requireAuth !== false &&
    (isCallerProtected ||
      Boolean(ep.authRuleId) ||
      Boolean(ep.requiredRoles && ep.requiredRoles.length > 0) ||
      Boolean(ep.requiredScopes && ep.requiredScopes.length > 0));

  // Build the JSON-safe options object for requireAuth().
  // JSON.stringify ensures user-supplied role strings are safely escaped —
  // never interpolated as raw code regardless of what the canvas config contains.
  const authOptionsObj: { roles?: string[] } = {};
  if (ep.requiredRoles && ep.requiredRoles.length > 0) {
    authOptionsObj.roles = ep.requiredRoles;
  }
  const authOptions = JSON.stringify(authOptionsObj);

  return {
    requiresAuth,
    authOptions,
  };
}
