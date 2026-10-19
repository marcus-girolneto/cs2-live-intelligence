import { normalizePlans, planUpdateBody, type Plan } from "@/features/billing";
import { platformHttp, seg, type HttpClient } from "@/shared/http";
import type { AppSettings, AdminUser, TestResult } from "../model/types";

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
  reprocess(): Promise<{ queued?: number }>;
  setRole(userId: string, role: string): Promise<AdminUser>;
  testActive(purpose: "review" | "live"): Promise<TestResult>;
  saveProvider(id: string | null, body: Record<string, unknown>): Promise<void>;
  deleteProvider(id: string): Promise<void>;
  testProvider(id: string, model?: string): Promise<TestResult>;
  listModels(id: string): Promise<ModelList>;
  getPlans(): Promise<Plan[]>;
  /** PUT admin/plans takes one plan per request ({id, …partial}). */
  savePlans(plans: Plan[]): Promise<Plan[]>;
  setUserPlan(userId: string, planId: string, until?: string): Promise<void>;
}

export function createAdminApi(http: HttpClient = platformHttp): AdminApi {
  const api: AdminApi = {
    read: <T>(path: string) => http.get<T>(path),
    saveAssignments: async (body) => {
      await http.put("admin/ai/assignments", body);
    },
    saveSettings: (body) => http.put<AppSettings>("admin/settings", body),
    reprocess: () =>
      http.post<{ queued?: number }>("admin/analyses/reprocess", {}),
    setRole: (userId, role) =>
      http.put<AdminUser>(`admin/users/${seg(userId)}/role`, { role }),
    testActive: (purpose) =>
      http.post<TestResult>("ai/test", purpose === "live" ? { purpose } : {}, {
        timeoutMs: AI_TIMEOUT,
      }),
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
  };
  return api;
}
export const adminApi = createAdminApi();
