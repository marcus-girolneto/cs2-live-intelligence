/** Admin credit economy: settings form (mirrors the API's strict schema) and helpers. */
import { finite } from "@/shared/format";

export type CreditSettings = {
  welcomeCredits: number;
  quickCost: number;
  deepCost: number;
  proDeepCost: number;
  teamCost: number;
  dailySafetyCap: number;
  minSteamAgeDays: number;
  maxGrantsPerNetwork: number;
  networkWindowDays: number;
};
export const CREDIT_DEFAULTS: CreditSettings = {
  welcomeCredits: 1,
  quickCost: 1,
  deepCost: 3,
  proDeepCost: 2,
  teamCost: 4,
  dailySafetyCap: 30,
  minSteamAgeDays: 30,
  maxGrantsPerNetwork: 3,
  networkWindowDays: 30,
};
export const CREDIT_FIELDS: {
  key: keyof CreditSettings;
  label: string;
  hint: string;
  min: number;
}[] = [
  {
    key: "welcomeCredits",
    label: "Welcome credits",
    hint: "Granted once to each eligible new Steam account.",
    min: 0,
  },
  {
    key: "quickCost",
    label: "Quick review cost",
    hint: "Credits per Quick review.",
    min: 1,
  },
  {
    key: "deepCost",
    label: "Deep review cost",
    hint: "Credits per Deep review (Free and Basic).",
    min: 1,
  },
  {
    key: "proDeepCost",
    label: "Deep review cost on Pro",
    hint: "Discounted Deep review for Pro.",
    min: 1,
  },
  {
    key: "teamCost",
    label: "Team review cost",
    hint: "Credits per Team review (Pro pays one less).",
    min: 1,
  },
  {
    key: "dailySafetyCap",
    label: "Daily safety cap",
    hint: "Most AI reviews one account can run per day, whatever its balance.",
    min: 1,
  },
  {
    key: "minSteamAgeDays",
    label: "Minimum Steam account age (days)",
    hint: "Younger accounts don't get the welcome credit.",
    min: 0,
  },
  {
    key: "maxGrantsPerNetwork",
    label: "Welcome grants per network",
    hint: "Limits farming of welcome credits from one network.",
    min: 1,
  },
  {
    key: "networkWindowDays",
    label: "Network window (days)",
    hint: "Period in which the per-network limit applies.",
    min: 1,
  },
];

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
export function normalizeCreditSettings(raw: unknown): CreditSettings {
  const o = obj(obj(raw)?.settings) ?? obj(raw) ?? {};
  const out = { ...CREDIT_DEFAULTS };
  for (const f of CREDIT_FIELDS) {
    const v = finite(o[f.key]);
    if (v !== null && v >= f.min) out[f.key] = Math.round(v);
  }
  return out;
}
/** Signed integer adjustment ("+5", "-2"); undefined when invalid or zero. */
export function parseDelta(v: string): number | undefined {
  const n = Number(v.trim().replace(/^\+/, ""));
  return Number.isInteger(n) && n !== 0 && Math.abs(n) <= 10000 ? n : undefined;
}

/** A credit pack as the admin edits it (deactivate instead of deleting). */
export type AdminPack = {
  id: string;
  name: string;
  credits: number;
  prices: { BRL: number; USD: number };
  badge: string | null;
  active: boolean;
  sort: number;
  stripePrices?: Record<string, string>;
};
export const PACK_ID = /^[a-z][a-z0-9_-]{0,31}$/;
export function normalizeAdminPacks(raw: unknown): AdminPack[] {
  const list = obj(raw)?.packs;
  return (Array.isArray(list) ? list : [])
    .flatMap((p, i): AdminPack[] => {
      const o = obj(p);
      const id = o && typeof o.id === "string" ? o.id : null;
      const credits = o && finite(o.credits);
      if (!o || !id || !credits) return [];
      const prices = obj(o.prices) ?? {};
      const stripe = obj(o.stripePrices);
      return [
        {
          id,
          name: typeof o.name === "string" ? o.name : id,
          credits: Math.round(credits),
          prices: {
            BRL: Math.max(0, Math.round(finite(prices.BRL) ?? 0)),
            USD: Math.max(0, Math.round(finite(prices.USD) ?? 0)),
          },
          badge: typeof o.badge === "string" && o.badge ? o.badge : null,
          active: o.active !== false,
          sort: Math.round(finite(o.sort) ?? i),
          ...(stripe && Object.keys(stripe).length
            ? { stripePrices: stripe as Record<string, string> }
            : {}),
        },
      ];
    })
    .sort((a, b) => a.sort - b.sort);
}
/** Body of PUT admin/credits/packs (the API schema is strict). */
export const packsBody = (packs: AdminPack[]) => ({
  packs: packs.map((p, i) => ({
    id: p.id,
    name: p.name.trim(),
    credits: p.credits,
    prices: p.prices,
    badge: p.badge,
    active: p.active,
    sort: i,
    ...(p.stripePrices ? { stripePrices: p.stripePrices } : {}),
  })),
});
