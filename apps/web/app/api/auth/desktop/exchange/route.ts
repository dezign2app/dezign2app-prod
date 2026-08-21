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

    return NextResponse.json({
      token: ticketData.token,
      userId: ticketData.userId,
      success: true,
    });
  } catch (error) {
    console.error("[Desktop Auth Exchange] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
