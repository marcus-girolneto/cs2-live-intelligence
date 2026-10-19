import type { LiveState } from "@cs2/contracts";
import type { LiveBroadcaster } from "../../infrastructure/realtime/live-broadcaster.js";
import {
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../../shared/errors/index.js";
import type { LiveSessionStore } from "../telemetry/telemetry.repository.js";
import type {
  LiveSessionsDto,
  LiveSocketQuery,
  TicketDto,
} from "./live.dto.js";
import type { TicketStore } from "./ticket-store.js";

/** A WebSocket admitted to a session: who it belongs to and the snapshot to send first. */
export interface LiveAdmission {
  ownerId: string;
  sessionId: string;
  snapshot: LiveState | null;
}

/** Owner-scoped live session reads, ticket issuing and WebSocket admission. */
export class LiveService {
  constructor(
    private readonly store: LiveSessionStore,
    private readonly tickets: TicketStore,
    private readonly broadcaster: LiveBroadcaster,
    private readonly housekeeping: () => void,
    private readonly options: { webOrigin: string; maxConnections: number },
  ) {}

  async sessions(ownerId: string): Promise<LiveSessionsDto> {
    return { sessions: await this.store.history(ownerId) };
  }

  async session(ownerId: string, id: string): Promise<LiveState> {
    this.housekeeping();
    const session = await this.store.session(id);
    if (!session || session.ownerId !== ownerId)
      throw new NotFoundError("Session not found");
    return session.state;
  }

  /** A ticket may target a session that does not exist yet, but never another owner's. */
  async ticket(ownerId: string, sessionId: string): Promise<TicketDto> {
    this.housekeeping();
    const session = await this.store.session(sessionId);
    if (session && session.ownerId !== ownerId)
      throw new NotFoundError("Session not found");
    if (this.tickets.full)
      throw new TooManyRequestsError("Ticket capacity reached");
    return { ticket: this.tickets.issue(ownerId, sessionId) };
  }

  /** Checks origin, capacity and the single-use ticket before the WebSocket upgrade. */
  async admit(
    origin: string | undefined,
    query: LiveSocketQuery,
  ): Promise<LiveAdmission> {
    if (origin !== this.options.webOrigin)
      throw new ForbiddenError("Origin rejected");
    if (this.broadcaster.connections >= this.options.maxConnections)
      throw new TooManyRequestsError("Connection capacity reached");
    this.housekeeping();
    const ticket = this.tickets.consume(query.ticket ?? "", query.sessionId);
    if (!ticket) throw new UnauthorizedError("Invalid ticket");
    const session = await this.store.session(ticket.sessionId);
    if (session && session.ownerId !== ticket.ownerId)
      throw new NotFoundError("Session not found");
    return {
      ownerId: ticket.ownerId,
      sessionId: ticket.sessionId,
      snapshot: session?.state ?? null,
    };
  }

  /** Observer callback: the owner's channels and pending tickets stop working. */
  invalidateOwner(ownerId: string): void {
    this.broadcaster.disconnectOwner(ownerId);
    this.tickets.revokeOwner(ownerId);
  }
}
