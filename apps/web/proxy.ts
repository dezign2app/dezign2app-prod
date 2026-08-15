import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/api/public(.*)",
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

const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

const isIgnoredRoute = createRouteMatcher([
  "/api/inngest(.*)",
  "/api/ai(.*)",
  "/api/checkout(.*)",
  "/api/auth/desktop(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Skip authentication for ignored routes
  if (isIgnoredRoute(req)) {
    return NextResponse.next();
  }

  const isElectron =
    req.headers.get("x-electron-app") === "1" ||
    req.cookies.get("is_electron")?.value === "1";

  // If in Electron and trying to access marketing/landing/public pages, redirect directly to /projects
  if (isElectron && isExcludedDesktopRoute(req)) {
    return NextResponse.redirect(new URL("/projects", req.url));
  }

  const session = await auth();

  // 1. If user is signed in and tries to access auth pages, send them to redirect_url or /projects
  if (session.userId && isAuthRoute(req)) {
    const redirectUrl =
      req.nextUrl.searchParams.get("redirect_url") ||
      req.nextUrl.searchParams.get("fallback_redirect_url");
    if (redirectUrl) {
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
    return NextResponse.redirect(new URL("/projects", req.url));
  }

  // 2. Protect non-public routes
  if (!isPublicRoute(req) && !isAuthRoute(req) && !session.userId) {
    return session.redirectToSignIn();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
