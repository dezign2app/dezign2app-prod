import { PageInfo } from "./types";
import { BackendNodeData } from "@workspace/canvas";

/**
 * Generates Next.js 16 proxy.ts for route protection (replaces deprecated middleware.ts)
 * Implements Tier 1: Lightweight optimistic session cookie redirect using getSessionCookie(request)
 */
export function generateProxy(pagesInfo: PageInfo[], authNodeData?: BackendNodeData): string {
  const protectedPages = pagesInfo.filter(
    (p) => p.accessType && p.accessType !== "public",
  );

  const redirects = authNodeData?.redirects || {};
  const signInPageUrl = redirects.signInPageUrl || "/login";
  const signUpPageUrl = redirects.signUpPageUrl || "/register";
  const signInRedirectUrl = redirects.signInRedirectUrl || "/";

  if (protectedPages.length === 0 && !authNodeData) {
    return `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
`;
  }

  const routeRules = protectedPages.map((p) => {
    const route = p.routePath;
    const accessType = p.accessType;
    const redirect = p.redirectTo || (accessType === "payment-gated" ? "/pricing" : accessType === "org-gated" ? "/select-org" : signInPageUrl);
    const roles = JSON.stringify(p.allowedRoles || []);
    const plans = JSON.stringify(p.requiredPlans || []);
    const orgRoles = JSON.stringify(p.allowedOrgRoles || []);

    return `  {
    path: "${route}",
    accessType: "${accessType}",
    redirectTo: "${redirect}",
    allowedRoles: ${roles},
    requiredPlans: ${plans},
    allowedOrgRoles: ${orgRoles},
  }`;
  });

  return `import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

interface RouteRule {
  path: string;
  accessType: "private" | "role-gated" | "payment-gated" | "org-gated";
  redirectTo: string;
  allowedRoles: string[];
  requiredPlans: string[];
  allowedOrgRoles: string[];
}

const PROTECTED_ROUTES: RouteRule[] = [
${routeRules.join(",\n")}
];

const AUTH_PAGES = [${JSON.stringify(signInPageUrl)}, ${JSON.stringify(signUpPageUrl)}];
const DEFAULT_AUTH_REDIRECT = ${JSON.stringify(signInRedirectUrl)};

/**
 * Next.js 16 Proxy / Middleware
 * Tier 1: Lightweight optimistic UX redirect check for session cookie presence
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  // Redirect authenticated user away from sign-in/sign-up page to default post-auth redirect
  if (sessionCookie && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL(DEFAULT_AUTH_REDIRECT, request.url));
  }

  const matchedRule = PROTECTED_ROUTES.find((rule) => 
    rule.path === "/" ? pathname === "/" : pathname.startsWith(rule.path)
  );

  if (!matchedRule) {
    return NextResponse.next();
  }

  // Tier 1 Optimistic Check using Better Auth cookie helper
  if (!sessionCookie) {
    const loginUrl = new URL(matchedRule.redirectTo || ${JSON.stringify(signInPageUrl)}, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists -> pass through to Next.js page for Tier 2 auth server-side validation
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
`;
}

export const generateMiddleware = generateProxy;




