"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { useDevelopersApi } from "../api/context";
import { DEFAULT_SCOPES, sortKeys, toggleScope } from "../model/keys";
import type { ApiKeyList, ApiScope, CreatedApiKey } from "../model/types";

/** Personal API keys: list, create (the full key is kept in memory until dismissed), revoke. */
export function useApiKeys() {
  const { t } = useI18n();
  const api = useDevelopersApi();
  const [list, setList] = useState<ApiKeyList | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>(DEFAULT_SCOPES);
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setList(await api.listKeys());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("Could not load your API keys."),
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Request failed."));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    await run(async () => {
      setCreated(
        await api.createKey({
          name: name.trim(),
          scopes,
          ...(expiresInDays ? { expiresInDays } : {}),
        }),
      );
      setName("");
      setScopes(DEFAULT_SCOPES);
      setExpiresInDays(0);
      await load();
    });
  }
  async function revoke(id: string) {
    if (
      !window.confirm(
        t("Revoke this API key? Apps using it stop working right away."),
      )
    )
      return;
    await run(async () => {
      await api.revokeKey(id);
      await load();
    });
  }
  return {
    list,
    keys: list ? sortKeys(list.keys) : [],
    name,
    setName,
    scopes,
    toggle: (scope: ApiScope) => setScopes((s) => toggleScope(s, scope)),
    expiresInDays,
    setExpiresInDays,
    created,
    dismissCreated: () => setCreated(null),
    error,
    busy,
    create,
    revoke,
  };
}
export type ApiKeysVM = ReturnType<typeof useApiKeys>;
