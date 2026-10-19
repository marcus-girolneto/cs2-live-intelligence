"use client";
import { useState } from "react";
import { useI18n } from "@/shared/i18n";
import { useAuthApi } from "../api/context";
import { steamSignInTarget } from "../model/session";

/** Starts Steam OpenID sign-in; only a steamcommunity.com https destination is followed. */
export function useSteamSignIn() {
  const { t } = useI18n();
  const api = useAuthApi();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const target = steamSignInTarget(await api.startSteamSignIn());
      if (!target) throw new Error(t("Invalid sign-in destination."));
      window.location.assign(target);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("Steam sign-in is unavailable."),
      );
      setBusy(false);
    }
  }
  return { busy, error, start };
}
