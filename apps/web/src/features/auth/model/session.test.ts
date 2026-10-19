import { describe, expect, it } from "vitest";
import type { Account } from "@/shared/session";
import {
  INITIAL_AUTH,
  authReducer,
  isSignedOutVisitor,
  needsLocalSession,
  steamSignInTarget,
} from "./session";

const account: Account = { ownerId: "o1", steamId: "7656" };

describe("auth state machine", () => {
  it("starts loading and signs in with an account", () => {
    expect(INITIAL_AUTH).toEqual({ status: "loading", account: null });
    expect(authReducer(INITIAL_AUTH, { type: "account", account })).toEqual({
      status: "signed-in",
      account,
    });
  });
  it("goes to the landing when signed out or unauthorized", () => {
    expect(authReducer(INITIAL_AUTH, { type: "signed-out" }).status).toBe(
      "signed-out",
    );
    const signedIn = authReducer(INITIAL_AUTH, { type: "account", account });
    expect(
      authReducer(signedIn, { type: "me-failed", unauthorized: true }),
    ).toEqual({ status: "signed-out", account: null });
  });
  it("keeps the account on a transient failure after sign-in", () => {
    const signedIn = authReducer(INITIAL_AUTH, { type: "account", account });
    expect(
      authReducer(signedIn, { type: "me-failed", unauthorized: false }),
    ).toBe(signedIn);
  });
  it("shows the service-down screen when the first GET me fails", () => {
    expect(
      authReducer(INITIAL_AUTH, { type: "me-failed", unauthorized: false }),
    ).toEqual({ status: "error", account: null });
  });
  it("decides from the session probe", () => {
    expect(isSignedOutVisitor({ hasSession: false, devLogin: false })).toBe(
      true,
    );
    expect(isSignedOutVisitor({})).toBe(true);
    expect(isSignedOutVisitor({ hasSession: true })).toBe(false);
    expect(needsLocalSession({ hasSession: false, devLogin: true })).toBe(true);
    expect(needsLocalSession({ hasSession: true, devLogin: true })).toBe(false);
  });
});

describe("Steam sign-in destination", () => {
  it("follows only https steamcommunity.com", () => {
    expect(
      steamSignInTarget("https://steamcommunity.com/openid/login?x=1"),
    ).toBe("https://steamcommunity.com/openid/login?x=1");
    expect(steamSignInTarget("http://steamcommunity.com/openid")).toBeNull();
    expect(
      steamSignInTarget("https://evil.example/steamcommunity.com"),
    ).toBeNull();
    expect(() => steamSignInTarget("not a url")).toThrow();
  });
});
