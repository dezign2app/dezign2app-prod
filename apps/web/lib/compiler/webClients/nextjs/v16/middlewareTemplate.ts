import { PageInfo } from "./types";

/**
 * Generates Next.js 16 proxy.ts for route protection (replaces deprecated middleware.ts)
 * Implements Tier 1: Lightweight optimistic session cookie redirect using getSessionCookie(request)
 */
export function generateProxy(pagesInfo: PageInfo[]): string {
  const protectedPages = pagesInfo.filter(
    (p) => p.accessType && p.accessType !== "public",
  );

  if (protectedPages.length === 0) {
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
    const redirect = p.redirectTo || (accessType === "payment-gated" ? "/pricing" : accessType === "org-gated" ? "/select-org" : "/login");
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

/**
 * Next.js 16 Proxy / Middleware
 * Tier 1: Lightweight optimistic UX redirect check for session cookie presence
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const matchedRule = PROTECTED_ROUTES.find((rule) => 
    rule.path === "/" ? pathname === "/" : pathname.startsWith(rule.path)
  );

  if (!matchedRule) {
    return NextResponse.next();
  }

  // Tier 1 Optimistic Check using Better Auth cookie helper
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL(matchedRule.redirectTo || "/login", request.url);
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



