import { describe, expect, it } from "vitest";
import { signinStatusOf, withoutSigninParam } from "./signinParam";

describe("signin param", () => {
  it("reads only known outcomes", () => {
    expect(signinStatusOf("?signin=failed")).toBe("failed");
    expect(signinStatusOf("?a=1&signin=unavailable")).toBe("unavailable");
    expect(signinStatusOf("?signin=ok")).toBeNull();
    expect(signinStatusOf("")).toBeNull();
  });
  it("removes the param and keeps the rest", () => {
    expect(withoutSigninParam("http://x.test/?signin=failed")).toBe("/");
    expect(withoutSigninParam("http://x.test/?a=1&signin=failed#pricing")).toBe(
      "/?a=1#pricing",
    );
  });
});
