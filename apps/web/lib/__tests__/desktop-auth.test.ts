import { describe, it, expect, beforeEach } from "vitest";
import { createTicket, consumeTicket } from "../desktop-auth";

describe("Desktop Auth Tickets", () => {
  it("creates a signed ticket and consumes it successfully", () => {
    const userId = "user-123";
    const token = "session-token-abc";

    const ticket = createTicket(userId, token);
    expect(ticket).toBeDefined();
    expect(ticket.startsWith("ticket_")).toBe(true);
    expect(ticket.includes(".")).toBe(true);

    const consumed = consumeTicket(ticket);
    expect(consumed).not.toBeNull();
    expect(consumed?.userId).toBe(userId);
    expect(consumed?.token).toBe(token);
    expect(consumed?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("enforces single-use consumption", () => {
    const ticket = createTicket("user-single", "token-single");
    const first = consumeTicket(ticket);
    expect(first).not.toBeNull();

    // Second consumption must fail
    const second = consumeTicket(ticket);
    expect(second).toBeNull();
  });

  it("rejects tampered signatures or payloads", () => {
    const ticket = createTicket("user-real", "token-real");
    const tampered = ticket.replace("ticket_", "ticket_tampered");
    expect(consumeTicket(tampered)).toBeNull();

    const tamperedSignature = ticket.slice(0, -5) + "zzzzz";
    expect(consumeTicket(tamperedSignature)).toBeNull();
  });

  it("handles empty or invalid ticket formats gracefully", () => {
    expect(consumeTicket("")).toBeNull();
    expect(consumeTicket("ticket_invalid")).toBeNull();
    expect(consumeTicket("random_string")).toBeNull();
  });
});
