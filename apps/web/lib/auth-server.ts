import { headers } from "next/headers";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { api } from "@workspace/backend/_generated/api";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  process.env.CONVEX_URL ||
  "";

const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
  process.env.CONVEX_SITE_URL ||
  (convexUrl ? convexUrl.replace(".convex.cloud", ".convex.site") : "");

const convexAuthNextJs = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
});

export interface ServerUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

export interface ServerSession {
  user: ServerUser;
  session?: {
    id?: string;
    userId: string;
    token?: string;
    expiresAt?: Date | string | number;
  };
}

export async function getAuthToken(): Promise<string | undefined> {
  try {
    return await convexAuthNextJs.getToken();
  } catch {
    return undefined;
  }
}

export async function getServerSession(
  reqHeaders?: Headers,
): Promise<ServerSession | null> {
  try {
    const headersList = reqHeaders || (await headers());
    let cookie = headersList.get("cookie") || "";
    if (cookie) {
      const tokenMatch = cookie.match(
        /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/,
      );
      const sessionToken = tokenMatch ? tokenMatch[1] : null;
      let authHeader = headersList.get("authorization") || "";

      if (sessionToken) {
        if (!cookie.includes("__Secure-better-auth.session_token=")) {
          cookie += `; __Secure-better-auth.session_token=${sessionToken}`;
        }
        if (!cookie.includes("better-auth.session_token=")) {
          cookie += `; better-auth.session_token=${sessionToken}`;
        }
        if (!authHeader) {
          authHeader = `Bearer ${sessionToken}`;
        }
      }

      const publicHost = process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
        : "www.dezign2app.com";

      const fetchHeaders: Record<string, string> = {
        cookie,
        "x-forwarded-host": publicHost,
        "x-forwarded-proto": "https",
      };
      if (authHeader) {
        fetchHeaders["authorization"] = authHeader;
      }

      const res = await fetch(`${convexSiteUrl}/api/auth/get-session`, {
        headers: fetchHeaders,
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          return {
            user: {
              id: data.user.id || data.user._id,
              email: data.user.email,
              name: data.user.name || data.user.email?.split("@")[0] || "User",
              image: data.user.image,
            },
            session: data.session,
          };
        }
      }
    }
  } catch (err) {
    console.error("[getServerSession] Error fetching session from Convex:", err);
  }

  // Fallback: Query current user directly via Convex auth identity
  try {
    const user = await convexAuthNextJs.fetchAuthQuery(api.users.getMe);
    if (user) {
      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
        session: {
          userId: user._id,
        },
      };
    }
  } catch {}

  return null;
}
