import { NextRequest, NextResponse } from "next/server";

function createRouteMatcher(patterns: string[]) {
  return (req: NextRequest) => {
    const pathname = req.nextUrl.pathname;
    return patterns.some((pattern) => {
      if (pattern === "/") {
        return pathname === "/";
      }
      const cleanPattern = pattern.replace(/\(\.\*\)/g, "").replace(/\*$/, "");
      if (pattern.includes(".*") || pattern.includes("*")) {
        return pathname === cleanPattern || pathname.startsWith(cleanPattern);
      }
      return pathname === pattern;
    });
  };
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/docs(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/terms-and-conditions(.*)",
  "/acceptable-use(.*)",
  "/aup(.*)",
  "/tutorials(.*)",
  "/blog(.*)",
  "/support(.*)",
  "/about(.*)",
  "/careers(.*)",
  "/contact(.*)",
  "/partners(.*)",
  "/changelog(.*)",
  "/integrations(.*)",
  "/early-believer(.*)",
  "/auth/desktop(.*)",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/api/public(.*)",
  "/api/auth(.*)",
]);

const isExcludedDesktopRoute = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/terms-and-conditions(.*)",
  "/acceptable-use(.*)",
  "/aup(.*)",
  "/tutorials(.*)",
  "/blog(.*)",
  "/support(.*)",
  "/about(.*)",
  "/careers(.*)",
  "/contact(.*)",
  "/partners(.*)",
  "/changelog(.*)",
  "/integrations(.*)",
  "/early-believer(.*)",
]);

const isAuthRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/auth/desktop(.*)",
]);

const isIgnoredRoute = createRouteMatcher([
  "/api/inngest(.*)",
  "/api/ai(.*)",
  "/api/checkout(.*)",
  "/api/auth(.*)",
]);

export default async function proxy(req: NextRequest) {
  // Skip authentication for ignored routes
  if (isIgnoredRoute(req)) {
    return NextResponse.next();
  }

  const isElectron =
    req.headers.get("x-electron-app") === "1" ||
    req.cookies.get("is_electron")?.value === "1";

  const sessionToken =
    req.cookies.get("better-auth.session_token")?.value ||
    req.cookies.get("__Secure-better-auth.session_token")?.value ||
    req.cookies.get("convex_jwt")?.value;

  const isSignedIn = !!sessionToken;

  // If in Electron and trying to access marketing/landing/public pages, redirect directly to /projects or /sign-in
  if (isElectron && isExcludedDesktopRoute(req)) {
    if (isSignedIn) {
      return NextResponse.redirect(new URL("/projects", req.url));
    } else {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  // 1. If user is signed in and tries to access auth pages, send them to redirect_url or /projects
  if (isSignedIn && isAuthRoute(req)) {
    // If user is accessing /auth/desktop, allow them through to generate the desktop token!
    if (req.nextUrl.pathname.startsWith("/auth/desktop")) {
      return NextResponse.next();
    }
    const redirectUrl =
      req.nextUrl.searchParams.get("redirect_url") ||
      req.nextUrl.searchParams.get("fallback_redirect_url");
    if (redirectUrl) {
      try {
        const targetUrl = new URL(redirectUrl, req.url);
        return NextResponse.redirect(targetUrl);
      } catch {
        const normalized = redirectUrl.startsWith("/") ? redirectUrl : `/${redirectUrl}`;
        return NextResponse.redirect(new URL(normalized, req.url));
      }
    }
    return NextResponse.redirect(new URL("/projects", req.url));
  }

  // 2. Protect non-public routes
  if (!isPublicRoute(req) && !isAuthRoute(req) && !isSignedIn) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
