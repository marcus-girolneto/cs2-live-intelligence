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
  /** English source text: translate with t() where it is shown. */
  tagline: "The AI coach that reads every frag.",
  description:
    "FRAGMIND reads your CS2 demos and tells you what is costing you rounds: aim, positions, timing, utility and a plan for your next match.",
  themeColor: "#0b0f14",
} as const;
