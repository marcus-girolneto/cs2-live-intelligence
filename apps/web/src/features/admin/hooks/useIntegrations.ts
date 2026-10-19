"use client";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { useAdminApi } from "../api/context";
import type {
  IntegrationName,
  Integrations,
  IntegrationTest,
} from "../model/integrations";
import { errorText, isForbidden } from "../model/types";

type Tests = Partial<
  Record<IntegrationName, { result: IntegrationTest | null; error: string }>
>;

/** Integrations status + save/test actions (every change reloads the status). */
export function useIntegrations(onForbidden: () => void) {
  const { t } = useI18n();
  const api = useAdminApi();
  const [data, setData] = useState<Integrations | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<IntegrationName | null>(null);
  const [tests, setTests] = useState<Tests>({});
  const [pk, setPk] = useState("");
  const [copied, setCopied] = useState(false);
  const fail = useCallback(
    (e: unknown) => {
      if (isForbidden(e)) onForbidden();
      setError(errorText(e, "Request failed."));
    },
    [onForbidden],
  );
  const load = useCallback(
    () =>
      api.getIntegrations().then((d) => {
        setData(d);
        setPk(d.stripe.publishableKey ?? "");
      }, fail),
    [api, fail],
  );
  useEffect(() => {
    void load();
  }, [load]);

  /** Every change is one request; the fresh status comes back from GET. */
  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(t(done));
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function test(name: IntegrationName) {
    setTesting(name);
    try {
      const result = await api.testIntegration(name);
      setTests((x) => ({ ...x, [name]: { result, error: "" } }));
    } catch (e) {
      setTests((x) => ({
        ...x,
        [name]: { result: null, error: errorText(e, "The test failed.") },
      }));
    } finally {
      setTesting(null);
    }
  }
  return {
    api,
    data,
    error,
    notice,
    busy,
    testing,
    tests,
    pk,
    setPk,
    copied,
    setCopied,
    run,
    test,
  };
}
