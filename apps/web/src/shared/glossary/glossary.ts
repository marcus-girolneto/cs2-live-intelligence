/**
 * Plain-language explanations of the CS2 jargon used across the app (EN source strings;
 * translated through the shared PT dictionary). One short line each.
 */
export const GLOSSARY = {
  adr: {
    term: "ADR",
    explain:
      "Average damage per round: how much health you take from enemies each round. 100 hp = one kill's worth. Around 80 is solid.",
  },
  kd: {
    term: "K/D",
    explain:
      "Kills divided by deaths. Above 1.0 means you got more kills than you died.",
  },
  kast: {
    term: "KAST",
    explain:
      "Share of rounds where you got a Kill, an Assist, Survived, or were Traded. It shows how often you were useful, even without kills.",
  },
  hs: {
    term: "HS%",
    explain: "Headshot %: the share of your kills that were headshots.",
  },
  headHits: {
    term: "Hits to the head",
    explain:
      "Of all your bullets that hit an enemy, how many hit the head. Higher means your crosshair sits at the right height.",
  },
  accuracy: {
    term: "Accuracy",
    explain:
      "Of all the bullets you fired, how many hit an enemy. Spraying from far away lowers it.",
  },
  trade: {
    term: "Trade",
    explain:
      "When a teammate kills your killer within about 5 seconds. A traded death isn't wasted: the round stays even.",
  },
  entry: {
    term: "Opening duel",
    explain:
      "The first fight of the round. Winning it puts your team up 5 vs 4, the biggest single swing in a round.",
  },
  clutch: {
    term: "Clutch",
    explain: "A round where you are the last one alive on your team.",
  },
  utility: {
    term: "Utility",
    explain: "Grenades: smokes, flashes, HE and molotovs.",
  },
  utilityDamage: {
    term: "Utility damage",
    explain: "Damage your HE grenades and molotovs did to enemies.",
  },
  flashAssist: {
    term: "Flash assist",
    explain: "A teammate got a kill on an enemy you had blinded.",
  },
  preAim: {
    term: "Pre-aim",
    explain:
      "Keeping your crosshair where an enemy's head will appear before you see them, so you don't have to move it to shoot.",
  },
  economy: {
    term: "Eco / Force / Full buy",
    explain:
      "Eco: you save money and buy little. Force: you spend everything though it's not enough for a full kit. Full buy: rifle, armor and grenades.",
  },
  isolated: {
    term: "Isolated death",
    explain:
      "Dying where no teammate could see or trade you, usually because you took a fight alone.",
  },
} as const;

export type GlossaryId = keyof typeof GLOSSARY;
export const GLOSSARY_IDS = Object.keys(GLOSSARY) as GlossaryId[];
