import { describe, expect, it } from "vitest";
import type { LiveState } from "@cs2/contracts";
import { applyMessage, display, freshness, retryDelay } from "./live";
const state: LiveState = {
  schemaVersion: "1.0",
  sessionId: "s",
  source: "gsi",
  visibility: "own-player",
  sequence: 1,
  observedAt: "2026-10-19T12:00:00.000Z",
  receivedAt: "2026-10-19T12:00:00.000Z",
  map: "de_dust2",
  ownStats: { kills: 0 },
};
describe("live projection", () => {
  it("clears omitted fields when a complete replacement diff arrives", () => {
    const missing = {
      schemaVersion: state.schemaVersion,
      sessionId: state.sessionId,
      source: state.source,
      visibility: state.visibility,
      sequence: state.sequence,
      observedAt: state.observedAt,
      receivedAt: state.receivedAt,
    };
    const next = applyMessage(
      state,
      {
        type: "diff",
        sessionId: "s",
        sequence: 2,
        changes: { ...missing, sequence: 2 },
      },
      "s",
    );
    expect(next?.ownStats).toBeUndefined();
    expect(next?.map).toBeUndefined();
  });
  it("accepts snapshots and rejects another session, old sequences and malformed frames", () => {
    expect(applyMessage(null, { type: "snapshot", state }, "s")).toEqual(state);
    expect(
      applyMessage(
        state,
        { type: "snapshot", state: { ...state, sessionId: "other" } },
        "s",
      ),
    ).toEqual(state);
    expect(
      applyMessage(
        state,
        { type: "diff", changes: { ...state, sequence: 0 } },
        "s",
      ),
    ).toEqual(state);
    expect(
      applyMessage(state, { type: "diff", changes: { sequence: 2 } }, "s"),
    ).toEqual(state);
    expect(
      applyMessage(state, { type: "heartbeat", at: state.receivedAt }, "s"),
    ).toEqual(state);
    expect(
      applyMessage(state, { type: "snapshot", state: null }, "s"),
    ).toBeNull();
  });
  it("shows zero faithfully and missing values explicitly", () => {
    expect(display(0)).toBe("0");
    expect(display(undefined)).toBe("Not available");
  });
  it("marks old or disconnected data stale without using provider time", () => {
    const now = Date.parse(state.receivedAt);
    expect(freshness(state, now + 4999, "connected").stale).toBe(false);
    expect(freshness(state, now + 5001, "connected").stale).toBe(true);
    expect(freshness(state, now, "disconnected").stale).toBe(true);
    expect(freshness(null, now, "connected").age).toBeNull();
  });
  it("bounds reconnect backoff", () => {
    expect(retryDelay(0)).toBe(1000);
    expect(retryDelay(1000)).toBe(5000);
  });
});

describe("pickSession", () => {
  const at = (iso: string) => Date.parse(iso);
  const sessions = [
    { sessionId: "old-dust2", receivedAt: "2026-10-19T12:00:50Z" },
    { sessionId: "older", receivedAt: "2026-10-19T11:00:00Z" },
  ] as never[];
  it("attaches to the newest session with recent data", async () => {
    const { pickSession } = await import("./connection");
    expect(pickSession(sessions, at("2026-10-19T12:01:00Z"))?.sessionId).toBe(
      "old-dust2",
    );
    expect(pickSession(sessions, at("2026-10-19T13:00:00Z"))).toBeUndefined();
  });
  it("after starting the simulator, waits for a session newer than the click", async () => {
    const { pickSession } = await import("./connection");
    const now = at("2026-10-19T12:01:00Z");
    expect(
      pickSession(sessions, now, at("2026-10-19T12:00:55Z")),
    ).toBeUndefined();
    const withSim = [
      { sessionId: "sim", receivedAt: "2026-10-19T12:00:58Z" },
      ...sessions,
    ] as never[];
    expect(
      pickSession(withSim, now, at("2026-10-19T12:00:55Z"))?.sessionId,
    ).toBe("sim");
  });
});
