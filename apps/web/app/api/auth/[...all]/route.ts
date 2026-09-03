import { NextRequest, NextResponse } from "next/server";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  process.env.CONVEX_URL ||
  "";

const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  process.env.CONVEX_SITE_URL ||
  (convexUrl ? convexUrl.replace(".convex.cloud", ".convex.site") : "");

async function handleProxy(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const nextUrl = `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`;
  const headers = new Headers(req.headers);

  // Strip hop-by-hop headers
  headers.delete("transfer-encoding");
  headers.delete("content-length");
  headers.delete("connection");
  headers.set("accept-encoding", "application/json");
  headers.set("host", new URL(convexSiteUrl).host);

  // Extract session token from cookie
  const rawCookie = headers.get("cookie") || "";
  const tokenMatch = rawCookie.match(
    /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/,
  );
  const sessionToken = tokenMatch ? tokenMatch[1] : null;

  if (sessionToken) {
    let normalizedCookie = rawCookie;
    if (!normalizedCookie.includes("__Secure-better-auth.session_token=")) {
      normalizedCookie += `; __Secure-better-auth.session_token=${sessionToken}`;
    }
    if (!normalizedCookie.includes("better-auth.session_token=")) {
      normalizedCookie += `; better-auth.session_token=${sessionToken}`;
    }
    headers.set("cookie", normalizedCookie);

    if (!headers.has("authorization")) {
      headers.set("authorization", `Bearer ${sessionToken}`);
    }
  }

  // Handle host forwarding for local loopback (Electron desktop)
  const isLoopback =
    requestUrl.hostname === "127.0.0.1" ||
    requestUrl.hostname === "localhost" ||
    req.headers.get("x-electron-app") === "1";

  if (isLoopback && process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const publicHost = new URL(process.env.NEXT_PUBLIC_APP_URL).host;
      headers.set("x-forwarded-host", publicHost);
      headers.set("x-forwarded-proto", "https");
      headers.set("x-better-auth-forwarded-host", publicHost);
      headers.set("x-better-auth-forwarded-proto", "https");
    } catch {
      headers.set("x-forwarded-host", requestUrl.host);
      headers.set("x-forwarded-proto", requestUrl.protocol.replace(/:$/, ""));
      headers.set("x-better-auth-forwarded-host", requestUrl.host);
      headers.set("x-better-auth-forwarded-proto", requestUrl.protocol.replace(/:$/, ""));
    }
  } else {
    headers.set("x-forwarded-host", requestUrl.host);
    headers.set("x-forwarded-proto", requestUrl.protocol.replace(/:$/, ""));
    headers.set("x-better-auth-forwarded-host", requestUrl.host);
    headers.set("x-better-auth-forwarded-proto", requestUrl.protocol.replace(/:$/, ""));
  }

  const init: RequestInit = {
    headers,
    method: req.method,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  const res = await fetch(nextUrl, init);

  // Clone response headers so we can duplicate un-prefixed cookies for non-HTTPS desktop clients
  const responseHeaders = new Headers(res.headers);

  const setCookieHeaders = res.headers.getSetCookie?.() || [];
  if (setCookieHeaders.length > 0) {
    responseHeaders.delete("set-cookie");
    for (const cookieStr of setCookieHeaders) {
      responseHeaders.append("set-cookie", cookieStr);
      if (cookieStr.includes("__Secure-better-auth.session_token=")) {
        const plainCookie = cookieStr
          .replace("__Secure-better-auth.session_token=", "better-auth.session_token=")
          .replace(/;\s*Secure/i, "");
        responseHeaders.append("set-cookie", plainCookie);
      }
    }
  }

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest) {
  return handleProxy(req);
}

export async function POST(req: NextRequest) {
  return handleProxy(req);
}
