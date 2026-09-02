"use server";

import { getServerSession, getAuthToken, type ServerSession } from "@/lib/auth-server";
import { headers, cookies } from "next/headers";
import { createTicket } from "@/lib/desktop-auth";

export async function generateUserToken(): Promise<string> {
  const reqHeaders = await headers();
  const session = await getServerSession(reqHeaders);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const cookieStore = await cookies();
  const rawSessionCookie =
    cookieStore.get("better-auth.session_token")?.value ||
    cookieStore.get("__Secure-better-auth.session_token")?.value;

  const token =
    rawSessionCookie ||
    session.session?.token ||
    (await getAuthToken()) ||
    session.session?.id ||
    session.user.id;
  return token;
}

export async function createDesktopSignInToken(): Promise<{ token: string }> {
  const reqHeaders = await headers();
  const cookieStore = await cookies();
  const rawSessionCookie =
    cookieStore.get("better-auth.session_token")?.value ||
    cookieStore.get("__Secure-better-auth.session_token")?.value;

  let session: ServerSession | null = null;
  try {
    session = await getServerSession(reqHeaders);
  } catch (e) {
    console.warn("[createDesktopSignInToken] getServerSession failed:", e);
  }

  const userId =
    session?.user?.id ||
    session?.session?.userId ||
    "desktop_user";

  const token =
    rawSessionCookie ||
    session?.session?.token ||
    (await getAuthToken()) ||
    session?.session?.id ||
    userId;

  if (!token && !rawSessionCookie) {
    throw new Error("Unauthorized");
  }

  const ticket = createTicket(userId, token);

  return { token: ticket };
}

export async function logoutUser(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    for (const c of allCookies) {
      if (
        c.name.includes("better-auth") ||
        c.name.includes("convex") ||
        c.name === "is_electron" ||
        c.name.toLowerCase().includes("session") ||
        c.name.toLowerCase().includes("token")
      ) {
        cookieStore.delete(c.name);
        cookieStore.set(c.name, "", {
          maxAge: 0,
          expires: new Date(0),
          path: "/",
        });
      }
    }
  } catch (e) {
    console.error("[logoutUser] Error clearing server cookies:", e);
  }
  return { success: true };
}
