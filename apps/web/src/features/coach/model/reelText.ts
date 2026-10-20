import type { Translate } from "@/shared/i18n";
import { placeName, weaponName } from "@/shared/format";
import type { ReelClip } from "../api/coach.api";

/** Localized chip label of a reel clip ("Round 5: 2 kills, opening, AK-47"). */
export function reelLabel(c: ReelClip, t: Translate): string {
  const round = t("Round {n}", { n: c.round });
  const m = c.moment;
  if (!m) return round;
  const parts =
    c.kind === "highlight"
      ? [
          m.kills >= 2
            ? t("{n, plural, one {# kill} other {# kills}}", { n: m.kills })
            : t("Kill"),
          ...(m.opening ? [t("opening duel")] : []),
          ...(m.weapon ? [weaponName(m.weapon) ?? m.weapon] : []),
        ]
      : [
          t("Death"),
          ...(m.opening ? [t("opening duel")] : []),
          ...(m.traded === false ? [t("untraded")] : []),
          ...(m.place
            ? [t("at {place}", { place: placeName(m.place) ?? m.place })]
            : []),
        ];
  return `${round}: ${parts.join(", ")}`;
}
