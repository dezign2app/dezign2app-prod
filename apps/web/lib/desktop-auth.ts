// In-memory single-use ticket store for desktop browser-to-app handoff
interface DesktopTicket {
  userId: string;
  token: string;
  expiresAt: number;
}

const desktopTickets = new Map<string, DesktopTicket>();

// Periodically clean up expired tickets
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of desktopTickets.entries()) {
    if (value.expiresAt < now) {
      desktopTickets.delete(key);
    }
  }
}, 60000);

export function createTicket(userId: string, token: string): string {
  const ticketId = `ticket_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
  desktopTickets.set(ticketId, {
    userId,
    token,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  return ticketId;
}

export function consumeTicket(ticketId: string): DesktopTicket | null {
  const ticket = desktopTickets.get(ticketId);
  if (!ticket) return null;

  desktopTickets.delete(ticketId); // Single-use

  if (ticket.expiresAt < Date.now()) {
    return null;
  }

  return ticket;
}
