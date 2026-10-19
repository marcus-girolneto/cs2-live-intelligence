import type { FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type { LiveState } from "@cs2/contracts";
import type { LiveBroadcaster } from "../../infrastructure/realtime/live-broadcaster.js";
import { ValidationError } from "../../shared/errors/index.js";
import { ownerOf } from "../../shared/http/principal.js";
import {
  ticketRequestSchema,
  type LiveSessionsDto,
  type LiveSocketQuery,
  type TicketDto,
} from "./live.dto.js";
import type { LiveAdmission, LiveService } from "./live.service.js";

type SocketRequest = FastifyRequest<{ Querystring: LiveSocketQuery }>;
const admissions = new WeakMap<FastifyRequest, LiveAdmission>();

export class LiveController {
  constructor(
    private readonly live: LiveService,
    private readonly broadcaster: LiveBroadcaster,
  ) {}

  sessions = async (request: FastifyRequest): Promise<LiveSessionsDto> =>
    this.live.sessions(ownerOf(request));

  session = async (
    request: FastifyRequest<{ Params: { id: string } }>,
  ): Promise<LiveState> =>
    this.live.session(ownerOf(request), request.params.id);

  ticket = async (request: FastifyRequest): Promise<TicketDto> => {
    const owner = ownerOf(request);
    const body = ticketRequestSchema.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid sessionId");
    return this.live.ticket(owner, body.data.sessionId);
  };

  /** preValidation of the WebSocket route: rejects the upgrade with an HTTP status. */
  admit = async (request: SocketRequest): Promise<void> => {
    admissions.set(
      request,
      await this.live.admit(request.headers.origin, request.query),
    );
  };

  connect = (socket: WebSocket, request: SocketRequest): void => {
    const admission = admissions.get(request)!;
    this.broadcaster.subscribe(
      socket,
      admission.ownerId,
      request.query.sessionId!,
    );
    this.broadcaster.send(socket, {
      type: "snapshot",
      state: admission.snapshot,
    });
  };
}
