import { randomBytes } from "node:crypto";

export interface LiveTicket {
  ownerId: string;
  sessionId: string;
  expires: number;
}
const TICKET_TTL_MS = 30000;

/** Single-use, 30-second WebSocket tickets (bounded, in process). */
export class TicketStore {
  private readonly tickets = new Map<string, LiveTicket>();
  constructor(
    private readonly now: () => number,
    private readonly capacity = 1000,
  ) {}

  get full(): boolean {
    return this.tickets.size >= this.capacity;
  }

  issue(ownerId: string, sessionId: string): string {
    const ticket = randomBytes(32).toString("base64url");
    this.tickets.set(ticket, {
      ownerId,
      sessionId,
      expires: this.now() + TICKET_TTL_MS,
    });
    return ticket;
  }

  /** Removes and returns the ticket when it exists and targets `sessionId`. */
  consume(
    ticket: string,
    sessionId: string | undefined,
  ): LiveTicket | undefined {
    const entry = this.tickets.get(ticket);
    if (!entry || entry.sessionId !== sessionId) return undefined;
    this.tickets.delete(ticket);
    return entry;
  }

  revokeOwner(ownerId: string): void {
    for (const [key, ticket] of this.tickets)
      if (ticket.ownerId === ownerId) this.tickets.delete(key);
  }

  prune(): void {
    for (const [key, entry] of this.tickets)
      if (this.now() >= entry.expires) this.tickets.delete(key);
  }
}
