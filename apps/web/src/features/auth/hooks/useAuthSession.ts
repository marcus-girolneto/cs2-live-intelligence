"use client";
import { useCallback, useEffect, useReducer } from "react";
import { isApiError } from "@/shared/http";
import { useAuthApi } from "../api/context";
import {
  INITIAL_AUTH,
  authReducer,
  isSignedOutVisitor,
  needsLocalSession,
} from "../model/session";

/**
 * Who is signed in: probes the session cookie, opens the local demo session when
 * enabled, then reads GET me. Re-runs whenever `refreshKey` (the pathname) changes.
 */
export function useAuthSession(refreshKey?: unknown) {
  const api = useAuthApi();
  const [state, dispatch] = useReducer(authReducer, INITIAL_AUTH);
  const refresh = useCallback(async () => {
    const session = await api.getSession();
    if (isSignedOutVisitor(session)) {
      dispatch({ type: "signed-out" });
      return;
    }
    if (needsLocalSession(session)) await api.openLocalSession();
    await api
      .getMe()
      .then((account) => dispatch({ type: "account", account }))
      .catch((e: unknown) =>
        dispatch({ type: "me-failed", unauthorized: isApiError(e, 401) }),
      );
  }, [api]);
  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);
  return { status: state.status, account: state.account, refresh };
}
