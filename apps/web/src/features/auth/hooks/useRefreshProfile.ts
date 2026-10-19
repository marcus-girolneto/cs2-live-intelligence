"use client";
import { useState } from "react";
import { isApiError } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { useAccount } from "@/shared/session";
import { useAuthApi } from "../api/context";

/** Re-reads the public Steam profile (throttled by the API) and refreshes the account. */
export function useRefreshProfile() {
  const { t } = useI18n();
  const api = useAuthApi();
  const { refresh } = useAccount();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  async function refreshProfile() {
    setBusy(true);
    setNote("");
    try {
      await api.refreshProfile();
      await refresh();
      setNote(t("Profile updated from Steam."));
    } catch (e) {
      setNote(
        isApiError(e, 429)
          ? t("Refreshed recently. Try again in a minute.")
          : t("Could not refresh the profile right now."),
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, note, refreshProfile };
}
