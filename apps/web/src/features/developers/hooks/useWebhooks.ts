"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { useDevelopersApi } from "../api/context";
import type {
  CreatedWebhook,
  Delivery,
  TestResult,
  Webhook,
  WebhookEvent,
} from "../model/types";
import { WEBHOOK_EVENTS } from "../model/types";

/** Webhooks: list, register (secret shown once), test delivery, delete, recent deliveries. */
export function useWebhooks() {
  const { t } = useI18n();
  const api = useDevelopersApi();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([...WEBHOOK_EVENTS]);
  const [created, setCreated] = useState<CreatedWebhook | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [list, recent] = await Promise.all([
        api.listWebhooks(),
        api.deliveries(20),
      ]);
      setWebhooks(list);
      setDeliveries(recent);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("Could not load your webhooks."),
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
  return {
    webhooks,
    deliveries,
    url,
    setUrl,
    events,
    toggleEvent: (event: WebhookEvent) =>
      setEvents((list) =>
        list.includes(event)
          ? list.filter((e) => e !== event)
          : WEBHOOK_EVENTS.filter((e) => e === event || list.includes(e)),
      ),
    created,
    dismissCreated: () => setCreated(null),
    tests,
    error,
    busy,
    load,
    create: () =>
      run(async () => {
        setCreated(await api.createWebhook(url.trim(), events));
        setUrl("");
        await load();
      }),
    test: (id: string) =>
      run(async () => {
        const result = await api.testWebhook(id);
        setTests((all) => ({ ...all, [id]: result }));
        await load();
      }),
    remove: async (id: string) => {
      if (
        !window.confirm(
          t("Delete this webhook? Pending deliveries are dropped."),
        )
      )
        return;
      await run(async () => {
        await api.deleteWebhook(id);
        await load();
      });
    },
  };
}
export type WebhooksVM = ReturnType<typeof useWebhooks>;
