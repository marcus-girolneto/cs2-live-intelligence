import {
  normalizeLedger,
  normalizePlans,
  planUpdateBody,
  type LedgerEntry,
  type Plan,
} from "@/features/billing";
import {
  normalizeAdminPacks,
  normalizeCreditSettings,
  packsBody,
  type AdminPack,
  type CreditSettings,
} from "../model/credits";
import {
  normalizeIntegrations,
  normalizeIntegrationTest,
  type IntegrationName,
  type Integrations,
  type IntegrationTest,
} from "../model/integrations";
import { platformHttp, seg, type HttpClient } from "@/shared/http";
import type {
  AppSettings,
  AdminUser,
  Purpose,
  TestResult,
} from "../model/types";

/** A real model call can take minutes; the API enforces its own timeout. */
const AI_TIMEOUT = 10 * 60 * 1000;

export type ModelList = {
  supported?: boolean;
  models?: unknown;
  error?: string;
};

/** Admin endpoints: AI providers/assignments, app settings, users, audit and plans. */
export interface AdminApi {
  /** Reads one admin resource by path (providers, ai/status, settings, users, audit). */
  read<T>(path: string): Promise<T>;
  saveAssignments(body: Record<string, unknown>): Promise<void>;
  saveSettings(body: Record<string, unknown>): Promise<AppSettings>;
  getIntegrations(): Promise<Integrations>;
  /** null removes the stored key (the .env bootstrap, if any, applies again). */
  saveSteam(webApiKey: string | null): Promise<void>;
  /** Omitted fields keep their value; null clears. */
  saveStripe(body: {
    secretKey?: string | null;
    webhookSecret?: string | null;
    publishableKey?: string | null;
    enabled?: boolean;
  }): Promise<void>;
  testIntegration(name: IntegrationName): Promise<IntegrationTest>;
  reprocess(): Promise<{ queued?: number }>;
  setRole(userId: string, role: string): Promise<AdminUser>;
  testActive(purpose: Purpose): Promise<TestResult>;
  saveProvider(id: string | null, body: Record<string, unknown>): Promise<void>;
  deleteProvider(id: string): Promise<void>;
  testProvider(id: string, model?: string): Promise<TestResult>;
  /** The purpose's own check (admin/ai/test), optionally on another provider/model. */
  testPurpose(
    purpose: Purpose,
    providerId?: string,
    model?: string,
  ): Promise<TestResult>;
  listModels(id: string): Promise<ModelList>;
  getPlans(): Promise<Plan[]>;
  /** PUT admin/plans takes one plan per request ({id, …partial}). */
  savePlans(plans: Plan[]): Promise<Plan[]>;
  setUserPlan(userId: string, planId: string, until?: string): Promise<void>;
  getCreditSettings(): Promise<CreditSettings>;
  saveCreditSettings(s: CreditSettings): Promise<CreditSettings>;
  getPacks(): Promise<AdminPack[]>;
  savePacks(packs: AdminPack[]): Promise<AdminPack[]>;
  getUserLedger(userId: string, limit?: number): Promise<LedgerEntry[]>;
  /** Adds (or removes, when negative) credits with a mandatory note. */
  adjustCredits(userId: string, delta: number, note: string): Promise<void>;
}

export function createAdminApi(http: HttpClient = platformHttp): AdminApi {
  const api: AdminApi = {
    read: <T>(path: string) => http.get<T>(path),
    saveAssignments: async (body) => {
      await http.put("admin/ai/assignments", body);
    },
    saveSettings: (body) => http.put<AppSettings>("admin/settings", body),
    getIntegrations: async () =>
      normalizeIntegrations(await http.get<unknown>("admin/integrations")),
    saveSteam: async (webApiKey) => {
      await http.put("admin/integrations/steam", { webApiKey });
    },
    saveStripe: async (body) => {
      await http.put("admin/integrations/stripe", body);
    },
    testIntegration: async (name) =>
      normalizeIntegrationTest(
        await http.post<unknown>(
          `admin/integrations/${seg(name)}/test`,
          {},
          {
            timeoutMs: 60000,
          },
        ),
      ),
    reprocess: () =>
      http.post<{ queued?: number }>("admin/analyses/reprocess", {}),
    setRole: (userId, role) =>
      http.put<AdminUser>(`admin/users/${seg(userId)}/role`, { role }),
    testActive: (purpose) =>
      http.post<TestResult>(
        "ai/test",
        purpose === "review_quick" ? {} : { purpose },
        {
          timeoutMs: AI_TIMEOUT,
        },
      ),
    saveProvider: async (id, body) => {
      if (id) await http.put(`admin/ai/providers/${seg(id)}`, body);
      else await http.post("admin/ai/providers", body);
    },
    deleteProvider: async (id) => {
      await http.delete(`admin/ai/providers/${seg(id)}`);
    },
    testProvider: (id, model) =>
      http.post<TestResult>(
        `admin/ai/providers/${seg(id)}/test`,
        model ? { model } : {},
        { timeoutMs: AI_TIMEOUT },
      ),
    testPurpose: (purpose, providerId, model) =>
      http.post<TestResult>(
        "admin/ai/test",
        {
          purpose,
          ...(providerId ? { providerId } : {}),
          ...(providerId && model ? { model } : {}),
        },
        { timeoutMs: AI_TIMEOUT },
      ),
    listModels: (id) =>
      http.get<ModelList>(`admin/ai/providers/${seg(id)}/models`, {
        timeoutMs: 60000,
      }),
    getPlans: async () =>
      normalizePlans(await http.get<unknown>("admin/plans")),
    async savePlans(plans) {
      for (const p of plans) await http.put("admin/plans", planUpdateBody(p));
      return api.getPlans();
    },
    setUserPlan: async (userId, planId, until) => {
      await http.put(`admin/users/${seg(userId)}/plan`, {
        planId,
        ...(until ? { until } : {}),
      });
    },
    getCreditSettings: async () =>
      normalizeCreditSettings(
        await http.get<unknown>("admin/credits/settings"),
      ),
    saveCreditSettings: async (body) =>
      normalizeCreditSettings(
        await http.put<unknown>("admin/credits/settings", body),
      ),
    getPacks: async () =>
      normalizeAdminPacks(await http.get<unknown>("admin/credits/packs")),
    async savePacks(packs) {
      const r = await http.put<unknown>(
        "admin/credits/packs",
        packsBody(packs),
      );
      const saved = normalizeAdminPacks(r);
      return saved.length ? saved : api.getPacks();
    },
    getUserLedger: async (userId, limit = 50) =>
      normalizeLedger(
        await http.get<unknown>(`admin/users/${seg(userId)}/ledger`, {
          query: { limit },
        }),
      ),
    adjustCredits: async (userId, delta, note) => {
      await http.post(`admin/users/${seg(userId)}/credits`, { delta, note });
    },
  };
  return api;
}
export const adminApi = createAdminApi();
