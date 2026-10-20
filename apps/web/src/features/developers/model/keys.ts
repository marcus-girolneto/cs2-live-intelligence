import { API_SCOPES, type ApiKey, type ApiScope } from "./types";

/** Scopes a new key starts with: read-only access to demos and analyses. */
export const DEFAULT_SCOPES: ApiScope[] = ["matches:read", "analyses:read"];
/** Expiry choices of the create form (days; 0 = never). */
export const EXPIRY_CHOICES = [0, 30, 90, 365] as const;

export function toggleScope(scopes: ApiScope[], scope: ApiScope): ApiScope[] {
  const next = scopes.includes(scope)
    ? scopes.filter((s) => s !== scope)
    : [...scopes, scope];
  return API_SCOPES.filter((s) => next.includes(s));
}

export function activeKeys(keys: ApiKey[]): number {
  return keys.filter((k) => k.status === "active").length;
}

/** Active keys first, then newest first. */
export function sortKeys(keys: ApiKey[]): ApiKey[] {
  return [...keys].sort(
    (a, b) =>
      Number(b.status === "active") - Number(a.status === "active") ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

/** Form validation: a name and at least one scope. */
export function canCreate(name: string, scopes: ApiScope[]): boolean {
  return (
    name.trim().length > 0 && name.trim().length <= 64 && scopes.length > 0
  );
}

/** True for the URLs the API accepts (it re-checks; this is only a hint). */
export function looksLikeWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(parsed.hostname))
    );
  } catch {
    return false;
  }
}
