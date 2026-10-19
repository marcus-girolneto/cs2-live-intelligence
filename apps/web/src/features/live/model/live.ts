import {
  liveStateSchema,
  STALE_AFTER_MS,
  type LiveState,
} from "@cs2/contracts";

export type Connection = "disconnected" | "connecting" | "connected";
export function applyMessage(
  previous: LiveState | null,
  raw: unknown,
  sessionId: string,
): LiveState | null {
  if (typeof raw !== "object" || raw === null || !("type" in raw))
    return previous;
  if (raw.type === "snapshot" && "state" in raw && raw.state === null)
    return null;
  const candidate =
    raw.type === "snapshot" && "state" in raw
      ? raw.state
      : raw.type === "diff" && "changes" in raw
        ? raw.changes
        : undefined;
  const parsed = liveStateSchema.safeParse(candidate);
  if (!parsed.success || parsed.data.sessionId !== sessionId) return previous;
  if (previous && parsed.data.sequence <= previous.sequence) return previous;
  // The contract defines each diff as a fresh projection: omitted values clear.
  return parsed.data;
}
export function freshness(
  state: LiveState | null,
  now: number,
  connection: Connection,
) {
  const age = state ? Math.max(0, now - Date.parse(state.receivedAt)) : null;
  const stale =
    age !== null && (age > STALE_AFTER_MS || connection !== "connected");
  return { age, stale };
}
export function display(value: string | number | undefined) {
  return value === undefined ? "Not available" : String(value);
}
export function retryDelay(attempt: number) {
  return Math.min(1000 * 2 ** Math.min(attempt, 3), 5000);
}
