import { NextRequest, NextResponse } from "next/server";
import { consumeTicket } from "@/lib/desktop-auth";

export async function POST(req: NextRequest) {
  try {
    const { ticket } = await req.json();

    if (!ticket || typeof ticket !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing ticket" },
        { status: 400 },
      );
    }

    let ticketData = consumeTicket(ticket.trim());

    if (!ticketData) {
      try {
        const authBaseUrl =
          process.env.NEXT_PUBLIC_DESKTOP_AUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:46500";
        const prodRes = await fetch(`${authBaseUrl}/api/auth/desktop/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket: ticket.trim() }),
        });
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData?.token) {
            ticketData = {
              token: prodData.token,
              userId: prodData.userId || "desktop_user",
              expiresAt: Date.now() + 60000,
            };
          }
        }
      } catch (remoteErr) {
        console.warn("[Desktop Auth Exchange] Remote exchange attempt failed:", remoteErr);
      }
    }

    if (!ticketData) {
      return NextResponse.json(
        { error: "Ticket expired or invalid" },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      token: ticketData.token,
      userId: ticketData.userId,
      success: true,
    });

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
      { status: 500 },
    );
  }
}
