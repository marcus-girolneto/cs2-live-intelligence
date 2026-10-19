"use client";
import { useState } from "react";
import { isApiError } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { useAuthApi } from "../api/context";

/** Signs out (revoking the session upstream) and returns to the landing page. */
export function useSignOut() {
  const { t } = useI18n();
  const api = useAuthApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await api.logout();
      window.location.assign("/");
    } catch (e) {
      setError(
        isApiError(e)
          ? (e.serverMessage ?? t("Sign-out failed."))
          : e instanceof Error
            ? e.message
            : t("Sign-out failed."),
      );
      setBusy(false);
    }
  }
  return { busy, error, signOut };
}
