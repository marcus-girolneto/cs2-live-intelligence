import { z } from "zod";
import type { LiveState } from "@cs2/contracts";

/** POST /v1/live/tickets body. */
export const ticketRequestSchema = z.object({
  sessionId: z.string().min(1).max(128),
});
export type TicketRequestDto = z.infer<typeof ticketRequestSchema>;
export type TicketDto = { ticket: string };
export type LiveSessionsDto = { sessions: LiveState[] };
/** GET /v1/live querystring. */
export type LiveSocketQuery = { sessionId?: string; ticket?: string };
