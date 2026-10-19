import { describe, expect, it } from "vitest";
import { privacyNotice } from "./privacy";
describe("local privacy notice", () => {
  it("discloses actual storage, optional provider and delayed file cleanup without legal assurances", () => {
    const text = privacyNotice.map((section) => section.text).join(" ");
    expect(text).toContain("PostgreSQL");
    expect(text).toContain("local filesystem");
    expect(text).toContain("no provider request");
    expect(text).toContain(
      "Player names, raw demos and raw telemetry are not included",
    );
    expect(text).toContain("1 and 90 days");
    expect(text).toContain("hourly");
    expect(text).toContain("durable deletion queue");
    expect(text).toContain("does not certify legal compliance");
    expect(text).toContain("Operator contact details are not configured");
  });
});
