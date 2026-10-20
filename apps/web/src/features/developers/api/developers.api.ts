import { platformHttp, seg, type HttpClient } from "@/shared/http";
import type {
  ApiKeyList,
  CreatedApiKey,
  CreatedWebhook,
  Delivery,
  NewApiKey,
  TestResult,
  Webhook,
  WebhookEvent,
} from "../model/types";

/** Settings → Developers: personal API keys and webhooks (session routes /v1/me/…). */
export interface DevelopersApi {
  listKeys(): Promise<ApiKeyList>;
  createKey(key: NewApiKey): Promise<CreatedApiKey>;
  revokeKey(id: string): Promise<void>;
  listWebhooks(): Promise<Webhook[]>;
  createWebhook(url: string, events: WebhookEvent[]): Promise<CreatedWebhook>;
  deleteWebhook(id: string): Promise<void>;
  testWebhook(id: string): Promise<TestResult>;
  deliveries(limit?: number): Promise<Delivery[]>;
}

export function createDevelopersApi(
  http: HttpClient = platformHttp,
): DevelopersApi {
  return {
    listKeys: () => http.get<ApiKeyList>("me/api-keys"),
    createKey: (key) => http.post<CreatedApiKey>("me/api-keys", key),
    revokeKey: async (id) => {
      await http.delete(`me/api-keys/${seg(id)}`);
    },
    listWebhooks: () =>
      http.get<{ webhooks: Webhook[] }>("me/webhooks").then((r) => r.webhooks),
    createWebhook: (url, events) =>
      http.post<CreatedWebhook>("me/webhooks", { url, events }),
    deleteWebhook: async (id) => {
      await http.delete(`me/webhooks/${seg(id)}`);
    },
    testWebhook: (id) =>
      http.request<TestResult>(`me/webhooks/${seg(id)}/test`, {
        method: "POST",
        timeoutMs: 30_000,
      }),
    deliveries: (limit = 20) =>
      http
        .get<{ deliveries: Delivery[] }>("me/webhooks/deliveries", {
          query: { limit },
        })
        .then((r) => r.deliveries),
  };
}
export const developersApi = createDevelopersApi();
