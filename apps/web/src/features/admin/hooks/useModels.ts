"use client";
import { useAdminApi } from "../api/context";
import { useCallback, useRef, useState } from "react";
import { normalizeModels, type ModelCatalog } from "../model/assign";
import { errorText } from "../model/types";
/** Models offered by each saved provider (GET admin/ai/providers/:id/models), cached. */
export function useModels() {
  const api = useAdminApi();
  const [catalogs, setCatalogs] = useState<Record<string, ModelCatalog>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  const fetchModels = useCallback(
    async (providerId: string) => {
      asked.current.add(providerId);
      setBusy((b) => ({ ...b, [providerId]: true }));
      setError((e) => ({ ...e, [providerId]: "" }));
      try {
        const c = normalizeModels(await api.listModels(providerId));
        setCatalogs((m) => ({ ...m, [providerId]: c }));
        if (!c.listed)
          setError((e) => ({
            ...e,
            [providerId]:
              c.error ?? "The provider did not return a model list.",
          }));
      } catch (e) {
        setError((x) => ({
          ...x,
          [providerId]: errorText(e, "Request failed."),
        }));
      } finally {
        setBusy((b) => ({ ...b, [providerId]: false }));
      }
    },
    [api],
  );
  /** Fetches a provider's list once (on first selection). */
  const ensure = useCallback(
    (providerId: string) => {
      if (providerId && !asked.current.has(providerId))
        void fetchModels(providerId);
    },
    [fetchModels],
  );
  return { catalogs, busy, error, fetchModels, ensure };
}
