"use client";
import { useAdminApi } from "../api/context";
import { useCallback, useState } from "react";
import { errorText } from "../model/types";
/** Models offered by a saved provider (GET admin/ai/providers/:id/models). */
export function useModels() {
  const api = useAdminApi();
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  const fetchModels = useCallback(
    async (providerId: string) => {
      setBusy(providerId);
      setError((e) => ({ ...e, [providerId]: "" }));
      try {
        const r = await api.listModels(providerId);
        const list = Array.isArray(r.models)
          ? r.models.filter((m): m is string => typeof m === "string")
          : [];
        setModels((m) => ({ ...m, [providerId]: list }));
        if (!list.length)
          setError((e) => ({
            ...e,
            [providerId]:
              r.error ?? "The provider did not return a model list.",
          }));
      } catch (e) {
        setError((x) => ({
          ...x,
          [providerId]: errorText(e, "Request failed."),
        }));
      } finally {
        setBusy(null);
      }
    },
    [api],
  );
  return { models, busy, error, fetchModels };
}
