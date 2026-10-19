import type { Account } from "@/shared/session";

/** GET /api/session: whether a session cookie exists (no failing 401 needed to know). */
export type SessionStatus = { hasSession?: boolean; devLogin?: boolean };
export type AuthStatus = "loading" | "signed-in" | "signed-out" | "error";
export type AuthState = { status: AuthStatus; account: Account | null };

export const INITIAL_AUTH: AuthState = { status: "loading", account: null };
/** Used when the session probe itself fails: try GET me anyway. */
export const UNKNOWN_SESSION: SessionStatus = {
  hasSession: true,
  devLogin: false,
};

/** Visitors without a session cookie (and no local auto-login) go straight to the landing. */
export const isSignedOutVisitor = (s: SessionStatus) =>
  !s.hasSession && !s.devLogin;
/** No cookie yet but automatic local sign-in is enabled: open the local session first. */
export const needsLocalSession = (s: SessionStatus) =>
  !s.hasSession && !!s.devLogin;

export type AuthEvent =
  | { type: "signed-out" }
  | { type: "account"; account: Account }
  | { type: "me-failed"; unauthorized: boolean };

/** Auth state machine: loading → signed-in | signed-out | error. */
export function authReducer(prev: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case "signed-out":
      return { status: "signed-out", account: null };
    case "account":
      return { status: "signed-in", account: event.account };
    case "me-failed":
      // A transient failure after sign-in keeps the current account on screen.
      if (prev.status === "signed-in" && !event.unauthorized) return prev;
      return {
        status: event.unauthorized ? "signed-out" : "error",
        account: null,
      };
  }
}

/** Only an https steamcommunity.com destination is followed (throws on an invalid URL). */
export function steamSignInTarget(url: string): string | null {
  const target = new URL(url);
  return target.protocol === "https:" &&
    target.hostname === "steamcommunity.com"
    ? target.href
    : null;
}
