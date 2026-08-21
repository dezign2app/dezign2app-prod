import { generateUserToken } from "@/app/(auth)/_components/actions";
import { getServerSession } from "@/lib/auth-server";
import { headers } from "next/headers";

/**
 * API endpoint to generate a Better Auth JWT token for MCP & Workflow authentication
 *
 * Usage:
 * ```
 * const response = await fetch("/api/auth/token");
 * const { token } = await response.json();
 * ```
 */
export async function GET() {
  try {
    const reqHeaders = await headers();
    const session = await getServerSession(reqHeaders);

    if (!session?.user?.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const token = await generateUserToken();

    if (!token) {
      return Response.json(
        { error: "Failed to generate token" },
        { status: 500 },
      );
    }

    return Response.json({
      token,
      userId: session.user.id,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("[API] Token generation error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
