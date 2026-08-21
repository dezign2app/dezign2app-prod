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

    const ticketData = consumeTicket(ticket.trim());

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
