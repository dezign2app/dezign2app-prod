import { NextRequest, NextResponse } from "next/server";
import { consumeTicket } from "@/lib/desktop-auth";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-electron-app",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { ticket } = await req.json();

    if (!ticket || typeof ticket !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing ticket" },
        { status: 400, headers: corsHeaders },
      );
    }

    let ticketData = consumeTicket(ticket.trim());

    // Optional proxy fallback if running inside local desktop shell and remote auth URL is set in env
    if (!ticketData) {
      const remoteAuthUrl = process.env.NEXT_PUBLIC_DESKTOP_AUTH_URL;
      if (
        remoteAuthUrl &&
        !remoteAuthUrl.includes("localhost") &&
        !remoteAuthUrl.includes("127.0.0.1")
      ) {
        try {
          const remoteRes = await fetch(`${remoteAuthUrl}/api/auth/desktop/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket: ticket.trim() }),
          });
          if (remoteRes.ok) {
            const remoteData = await remoteRes.json();
            if (remoteData?.token) {
              ticketData = {
                token: remoteData.token,
                userId: remoteData.userId || "desktop_user",
                expiresAt: Date.now() + 60000,
              };
            }
          }
        } catch (remoteErr) {
          console.warn("[Desktop Auth Exchange] Remote exchange attempt failed:", remoteErr);
        }
      }
    }

    if (!ticketData) {
      return NextResponse.json(
        { error: "Ticket expired or invalid" },
        { status: 401, headers: corsHeaders },
      );
    }

    const response = NextResponse.json(
      {
        token: ticketData.token,
        userId: ticketData.userId,
        success: true,
      },
      { headers: corsHeaders },
    );

    response.cookies.set("better-auth.session_token", ticketData.token, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      httpOnly: false,
    });
    response.cookies.set("is_electron", "1", {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      httpOnly: false,
    });

    return response;
  } catch (error) {
    console.error("[Desktop Auth Exchange] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
