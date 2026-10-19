import type { AnalysisResult } from "@/features/analysis";
import type {
  LiveSessionDto,
  MatchDto,
  MatchListDto,
} from "@/shared/api-types";
import {
  isApiError,
  platformHttp,
  seg,
  webHttp,
  type HttpClient,
} from "@/shared/http";
import { socketUrl } from "../model/connection";
import type {
  LiveCallRequest,
  LiveCallResult,
  Simulator,
  SimulatorAction,
  TicketResult,
} from "../model/types";

/** A real model call can take minutes; the API enforces its own timeout. */
const AI_TIMEOUT_MS = 10 * 60 * 1000;
const TICKET_TIMEOUT_MS = 7000;

/** Everything the second screen needs from the platform and the web's own routes. */
export interface LiveApi {
  listSessions(): Promise<LiveSessionDto[]>;
  listMatches(): Promise<MatchDto[]>;
  getAnalysis(analysisId: string): Promise<AnalysisResult>;
  /** Short-lived WebSocket ticket; aborted with `signal` or after 7 s. */
  requestTicket(sessionId: string, signal: AbortSignal): Promise<TicketResult>;
  simulatorStatus(): Promise<Simulator>;
  /** Starts/stops the simulator; rejects with the server's message. */
  simulate(action: SimulatorAction): Promise<Simulator>;
  liveCall(request: LiveCallRequest): Promise<LiveCallResult>;
  openSocket(sessionId: string, ticket: string): WebSocket;
}

export function liveCallBody({
  state,
  rounds,
  baseline,
  lang,
  sessionId,
  analysisId,
}: LiveCallRequest) {
  return {
    ...(sessionId ? { sessionId } : { state }),
    ...(analysisId && !sessionId ? { analysisId } : {}),
    recentRounds: rounds.slice(-12),
    ...(baseline
      ? {
          baseline: {
            kd: baseline.kd,
            killsPerRound: baseline.killsPerRound,
          },
        }
      : {}),
    lang,
  };
}

export function createLiveApi(
  http: HttpClient = platformHttp,
  web: HttpClient = webHttp,
  wsBase: string = process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:4000",
): LiveApi {
  return {
    listSessions: () =>
      http
        .get<{ sessions: LiveSessionDto[] }>("live/sessions")
        .then((r) => r.sessions),
    listMatches: () => http.get<MatchListDto>("matches").then((r) => r.matches),
    getAnalysis: (analysisId) =>
      http.get<AnalysisResult>(`analyses/${seg(analysisId)}`),
    async requestTicket(sessionId, signal) {
      try {
        const r = await web.post<{ ticket?: string; error?: string }>(
          "ticket",
          { sessionId },
          {
            signal: AbortSignal.any([
              signal,
              AbortSignal.timeout(TICKET_TIMEOUT_MS),
            ]),
          },
        );
        return r.ticket
          ? { ok: true, ticket: r.ticket }
          : { ok: false, status: 200, ...(r.error ? { error: r.error } : {}) };
      } catch (e) {
        if (!isApiError(e)) throw e;
        const error = e.serverMessage;
        return { ok: false, status: e.status, ...(error ? { error } : {}) };
      }
    },
    simulatorStatus: () => web.get<Simulator>("simulator"),
    async simulate(action) {
      try {
        return await web.post<Simulator>("simulator", { action });
      } catch (e) {
        throw new Error(
          isApiError(e)
            ? (e.serverMessage ?? "Request failed.")
            : "Request failed.",
        );
      }
    },
    liveCall: (request) =>
      http.post<LiveCallResult>("ai/live-call", liveCallBody(request), {
        timeoutMs: AI_TIMEOUT_MS,
      }),
    openSocket: (sessionId, ticket) =>
      new WebSocket(socketUrl(wsBase, sessionId, ticket)),
  };
}

export const liveApi = createLiveApi();
