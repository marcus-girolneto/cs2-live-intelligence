/**
 * The product's name lives here and only here. Every screen, title, persona label and
 * watermark reads from this object, so a rename is a one-line change.
 */
export const BRAND = {
  /** Wordmark, written in capitals in the display font. */
  name: "FRAGMIND",
  /** The two halves of the wordmark (the second one is drawn in the accent colour). */
  parts: ["FRAG", "MIND"] as const,
  short: "FM",
  /** Persona labels: the AI is always the product's own coach, never a model name. */
  coach: "FRAGMIND Coach",
  igl: "FRAGMIND IGL",
  tagline: {
    en: "The AI coach that reads every frag.",
    pt: "O coach de IA que lê cada frag.",
  },
  description: {
    en: "FRAGMIND reads your CS2 demos and tells you what is costing you rounds: aim, positions, timing, utility and a plan for your next match.",
    pt: "O FRAGMIND lê suas demos de CS2 e mostra o que está custando rounds: mira, posições, timing, utilitária e um plano para a próxima partida.",
  },
  themeColor: "#0b0f14",
} as const;
export type BrandLang = keyof typeof BRAND.tagline;
