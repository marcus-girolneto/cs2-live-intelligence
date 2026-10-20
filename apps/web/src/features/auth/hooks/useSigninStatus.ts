"use client";
import { useEffect, useState } from "react";
import {
  signinStatusOf,
  withoutSigninParam,
  type SigninStatus,
} from "../model/signinParam";

/** Reads `?signin=` once after a failed Steam login, then drops it from the URL. */
export function useSigninStatus(enabled = true) {
  const [status, setStatus] = useState<SigninStatus | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const s = signinStatusOf(window.location.search);
    if (!s) return;
    setStatus(s);
    window.history.replaceState(
      window.history.state,
      "",
      withoutSigninParam(window.location.href),
    );
  }, [enabled]);
  return { status, clear: () => setStatus(null) };
}
