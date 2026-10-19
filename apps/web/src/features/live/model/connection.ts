import type { LiveState } from "@cs2/contracts";
import type { LiveSessionDto } from "@/shared/api-types";
import type { Connection } from "./live";

/** HUD badge shown above the scoreboard. */
export type Badge = "live" | "simulated" | "replay" | "stale" | "offline";

/** Only sessions that sent data this recently are auto-connected ("live"). */
export const RECENT_MS = 2 * 60 * 1000;
export const DEFAULT_SESSION_ID = "dev-session";

/** Newest session first. */
export function sortSessions(sessions: LiveSessionDto[]): LiveSessionDto[] {
  return [...sessions].sort(
    (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt),
  );
}
export function isRecent(session: LiveSessionDto | undefined, now: number) {
  return !!session && now - Date.parse(session.receivedAt) < RECENT_MS;
}
/** A ?sessionId= value that may be used (non-empty, at most 128 characters). */
export function requestedSession(search: string): string | null {
  const requested = new URLSearchParams(search).get("sessionId");
  return requested && requested.length <= 128 ? requested : null;
}

export function hudBadge(
  state: LiveState | null,
  live: boolean,
  simulated: boolean | undefined,
): Badge {
  return !state
    ? "offline"
    : !live
      ? "stale"
      : simulated
        ? "simulated"
        : "live";
}

/** English status text (translated by the caller). */
export function connectionLabel(
  connection: Connection,
  state: LiveState | null,
  stale: boolean,
): string {
  return connection === "connecting"
    ? "Connecting…"
    : connection === "disconnected"
      ? state
        ? "Disconnected · stale data"
        : "Disconnected"
      : !state
        ? "Waiting for game data"
        : stale
          ? "Stale · last known state"
          : "Live";
}

/** WebSocket endpoint for one session, authorised by a short-lived ticket. */
export function socketUrl(base: string, sessionId: string, ticket: string) {
  const url = new URL(base);
  url.pathname = "/v1/live";
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("ticket", ticket);
  return url;
}
