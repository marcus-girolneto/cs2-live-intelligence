import type { ApiScope, WebhookEvent } from "../model/types";

type T = (text: string) => string;

/** What a scope allows, in plain words (literal t() calls for the i18n coverage test). */
export function scopeLabel(t: T, scope: ApiScope): string {
  switch (scope) {
    case "matches:read":
      return t("Read demos and their status");
    case "matches:write":
      return t("Upload and delete demos");
    case "analyses:read":
      return t("Read analyses, player metrics and saved reviews");
    case "reviews:write":
      return t("Request AI reviews (spends credits)");
    case "progress:read":
      return t("Read your progress");
    case "account:read":
      return t("Read account, plan and credits");
    case "webhooks:manage":
      return t("Manage webhooks");
  }
}

export function eventLabel(t: T, event: WebhookEvent): string {
  switch (event) {
    case "demo.completed":
      return t("Demo analysed");
    case "demo.failed":
      return t("Demo failed");
    case "review.completed":
      return t("AI review ready");
  }
}

export function keyStatusLabel(
  t: T,
  status: "active" | "expired" | "revoked",
): string {
  if (status === "active") return t("Active");
  if (status === "expired") return t("Expired");
  return t("Revoked");
}
