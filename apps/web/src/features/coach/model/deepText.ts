/**
 * Localized sentences of the Deep review, built from its numbers. The coaching package also
 * writes English sentences for the model ("3 deaths at Catwalk, 0 traded…"); those are never
 * shown. Every string here is an English source key translated with t().
 */
import type { Translate } from "@/shared/i18n";
import { placeName } from "@/shared/format";
import type { DangerZone, Lineup, NadeType } from "./deepTypes";

/** World units to meters (1 unit is about 2.54 cm). */
export const unitsToMeters = (units: number) => units * 0.0254;

export const NADE_NAME: Record<NadeType, string> = {
  flash: "Flashbang",
  smoke: "Smoke",
  he: "HE grenade",
  molotov: "Molotov",
  decoy: "Decoy",
};

/** Short labels (and tooltips) of the round table's machine tags. */
export const ROUND_TAGS: Record<string, { label: string; tip: string }> = {
  multi_kill: {
    label: "Multi-kill",
    tip: "You got two or more kills this round.",
  },
  clutch_win: {
    label: "Clutch won",
    tip: "You were the last one alive and won the round.",
  },
  opening_kill: {
    label: "Opening kill",
    tip: "You got the first kill of the round.",
  },
  opening_death: {
    label: "First death",
    tip: "You were the first player to die this round.",
  },
  untraded_death: {
    label: "Untraded death",
    tip: "No teammate killed your killer within 5 seconds.",
  },
  early_death: {
    label: "Early death",
    tip: "You died in the first 20 seconds of the round.",
  },
  zero_damage: {
    label: "No damage",
    tip: "You died without damaging an enemy.",
  },
  saved_utility: {
    label: "Unused utility",
    tip: "You died with two or more grenades still in your inventory.",
  },
};
/** A tag the table does not know yet still reads as words, never as snake_case. */
export const tagLabel = (tag: string) =>
  ROUND_TAGS[tag] ?? {
    label: tag.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    tip: "",
  };

export const BUY_LABEL: Record<string, string> = {
  pistol: "Pistol round",
  eco: "Eco",
  force: "Force buy",
  full: "Full buy",
};

/** History-compare metrics by key (the stored label is English). */
export const HISTORY_LABEL: Record<string, string> = {
  "crosshair-offset": "Crosshair offset at duel start",
  "pre-aimed": "Duels pre-aimed (< 5°)",
  "enemies-per-flash": "Enemies blinded per flash",
  "team-flash-rate": "Team-flash rate",
  "isolated-deaths": "Isolated deaths",
  "traded-deaths": "Deaths traded",
};

/** "2 of 3 traded · nearest teammate about 33 m away on average · 1 in a crossfire". */
export function zoneDetails(z: DangerZone, t: Translate, locale: string) {
  const n = (v: number) => v.toLocaleString(locale);
  return [
    z.traded !== null && z.deaths !== null
      ? t("{traded} of {deaths} traded", {
          traded: n(z.traded),
          deaths: n(z.deaths),
        })
      : null,
    z.avgIsolation !== null
      ? t("nearest teammate about {m} m away on average", {
          m: n(Math.round(unitsToMeters(z.avgIsolation))),
        })
      : null,
    z.crossfire
      ? t("{n, plural, one {# death} other {# deaths}} in a crossfire", {
          n: z.crossfire,
        })
      : null,
  ].filter((x): x is string => !!x);
}

/** "Flashbang at Top of Mid" / "Smoke into Bombsite A". */
export function lineupTitle(l: Lineup, t: Translate) {
  const nade = t(NADE_NAME[l.type ?? "smoke"]);
  const place = l.place ? (placeName(l.place) ?? l.place) : null;
  if (!place) return nade;
  return l.kind === "learn"
    ? t("{nade} into {place}", { nade, place })
    : t("{nade} at {place}", { nade, place });
}

/** What the throw did, or why the lobby's utility matters for you. */
export function lineupWhy(l: Lineup, t: Translate, locale: string) {
  const parts: string[] = [];
  if (l.kind === "repeat" && l.round !== null) {
    if (l.type === "flash" && l.enemiesFlashed !== null)
      parts.push(
        t(
          "Round {round}: blinded {n, plural, one {# enemy} other {# enemies}} for {s} s.",
          {
            round: l.round,
            n: l.enemiesFlashed,
            s: (l.blindSeconds ?? 0).toLocaleString(locale, {
              maximumFractionDigits: 1,
            }),
          },
        ),
      );
    else if (l.damage !== null)
      parts.push(
        t("Round {round}: {damage} damage.", {
          round: l.round,
          damage: l.damage,
        }),
      );
  }
  if (l.kind === "learn" && l.count !== null)
    parts.push(
      t(
        "The lobby threw it here {n, plural, one {once} other {# times}}; you died here {d, plural, one {once} other {# times}}.",
        { n: l.count, d: l.deathsThere ?? 0 },
      ),
    );
  if (l.fromPlace)
    parts.push(
      t("Thrown from {place}.", {
        place: placeName(l.fromPlace) ?? l.fromPlace,
      }),
    );
  return parts.join(" ");
}
