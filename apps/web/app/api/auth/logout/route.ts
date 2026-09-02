import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const response = NextResponse.json({ success: true });

  for (const c of allCookies) {
    if (
      c.name.includes("better-auth") ||
      c.name.includes("convex") ||
      c.name === "is_electron" ||
      c.name.toLowerCase().includes("session") ||
      c.name.toLowerCase().includes("token")
    ) {
      cookieStore.delete(c.name);
      response.cookies.set(c.name, "", {
        maxAge: 0,
        expires: new Date(0),
        path: "/",
      });
    }
  }

  // Explicitly ensure common auth cookie names are cleared
  const commonNames = [
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "better-auth.session_data",
    "__Secure-better-auth.session_data",
    "better-auth.dont_remember",
    "better-auth.state",
    "better-auth.pkce_code_verifier",
    "convex_jwt",
    "is_electron",
  ];

  for (const name of commonNames) {
    response.cookies.set(name, "", {
      maxAge: 0,
      expires: new Date(0),
      path: "/",
    });
  }

  return response;
}
