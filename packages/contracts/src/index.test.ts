import { describe, expect, it } from "vitest";
import { envelopeSchema, gsiSchema } from "./index.js";
describe("telemetry contract", () => {
  it("allows absent telemetry without fabricating numbers", () =>
    expect(gsiSchema.parse({})).toEqual({}));
  it("strips unknown fields including auth and roster", () =>
    expect(
      gsiSchema.parse({ auth: { token: "secret" }, allplayers: { enemy: {} } }),
    ).toEqual({}));
  it("rejects invalid known statistics", () =>
    expect(
      gsiSchema.safeParse({ player: { match_stats: { kills: -1 } } }).success,
    ).toBe(false));
  it("rejects client supplied ownership and unknown versions", () => {
    const event = {
      schemaVersion: "1.0",
      eventId: "e",
      deviceId: "d",
      sessionId: "s",
      sequence: 1,
      observedAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      source: "gsi",
      visibility: "own-player",
      payload: {},
    };
    expect(envelopeSchema.safeParse(event).success).toBe(true);
    expect(
      envelopeSchema.safeParse({ ...event, userId: "another-owner" }).success,
    ).toBe(false);
    expect(
      envelopeSchema.safeParse({ ...event, schemaVersion: "2.0" }).success,
    ).toBe(false);
  });
});
