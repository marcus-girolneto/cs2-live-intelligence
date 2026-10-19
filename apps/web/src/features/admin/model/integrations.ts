/** Admin → Integrations (Steam Web API, Stripe): status DTO → view model. Pure. */
export type IntegrationSource = "database" | "env" | "none";
export type IntegrationName = "steam" | "stripe";
export type SteamIntegration = {
  configured: boolean;
  source: IntegrationSource;
  last4: string | null;
  updatedAt: string | null;
};
export type StripeIntegration = {
  configured: boolean;
  source: IntegrationSource;
  secretKeyLast4: string | null;
  webhookConfigured: boolean;
  publishableKey: string | null;
  enabled: boolean;
  updatedAt: string | null;
};
export type Integrations = {
  steam: SteamIntegration;
  stripe: StripeIntegration;
  /** The API's public URL when the server reports it (for the webhook address). */
  apiPublicUrl: string | null;
};
export type IntegrationTest = {
  ok: boolean;
  latencyMs: number | null;
  detail: string | null;
  livemode: boolean | null;
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const str = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const sourceOf = (v: unknown, configured: boolean): IntegrationSource =>
  v === "database" || v === "env" || v === "none"
    ? v
    : configured
      ? "database"
      : "none";
/** Only the last 4 characters are ever shown (and only when they look like a suffix). */
const last4 = (v: unknown) => {
  const s = str(v);
  return s && s.length <= 8 ? s.slice(-4) : null;
};

export function normalizeIntegrations(raw: unknown): Integrations {
  const o = obj(raw);
  const s = obj(o.steam);
  const p = obj(o.stripe);
  const steamOn = s.configured === true;
  const stripeOn = p.configured === true;
  return {
    steam: {
      configured: steamOn,
      source: sourceOf(s.source, steamOn),
      last4: last4(s.last4),
      updatedAt: str(s.updatedAt),
    },
    stripe: {
      configured: stripeOn,
      source: sourceOf(p.source, stripeOn),
      secretKeyLast4: last4(p.secretKeyLast4),
      webhookConfigured: p.webhookConfigured === true,
      // Publishable keys are public by design (pk_…); anything else is not shown.
      publishableKey: str(p.publishableKey)?.startsWith("pk_")
        ? str(p.publishableKey)
        : null,
      enabled: p.enabled === true,
      updatedAt: str(p.updatedAt),
    },
    apiPublicUrl: str(o.apiPublicUrl) ?? str(p.apiPublicUrl),
  };
}

export function normalizeIntegrationTest(raw: unknown): IntegrationTest {
  const o = obj(raw);
  const ms = o.latencyMs;
  return {
    ok: o.ok === true,
    latencyMs:
      typeof ms === "number" && Number.isFinite(ms) && ms >= 0
        ? Math.round(ms)
        : null,
    detail: str(o.detail),
    livemode: typeof o.livemode === "boolean" ? o.livemode : null,
  };
}

/** Field checks before sending a secret (the API validates again). */
export function secretProblem(
  kind: "steam" | "stripe_secret" | "stripe_webhook" | "stripe_publishable",
  value: string,
): string | null {
  const v = value.trim();
  if (!v) return "Enter a value.";
  if (/\s/.test(v)) return "Keys never contain spaces.";
  switch (kind) {
    case "steam":
      return /^[A-Fa-f0-9]{32}$/.test(v)
        ? null
        : "A Steam Web API key is 32 hexadecimal characters.";
    case "stripe_secret":
      return /^(sk|rk)_(live|test)_/.test(v)
        ? null
        : "Stripe secret keys start with sk_live_, sk_test_ (or rk_ for restricted keys).";
    case "stripe_webhook":
      return v.startsWith("whsec_")
        ? null
        : "Stripe webhook secrets start with whsec_.";
    case "stripe_publishable":
      return /^pk_(live|test)_/.test(v)
        ? null
        : "Publishable keys start with pk_live_ or pk_test_.";
  }
}

/** Where Stripe must send events: the API's public URL + /v1/billing/webhook. */
export function webhookUrl(apiPublicUrl: string | null): string | null {
  const base = str(apiPublicUrl);
  if (!base || !/^https?:\/\//.test(base)) return null;
  return `${base.replace(/\/+$/, "")}/v1/billing/webhook`;
}
