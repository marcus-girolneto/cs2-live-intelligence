/**
 * Deep-tier prompt (igl-review-v11-deep): the quick IGL review (same persona, priority order,
 * safety, grounding, edge cases, language and identity rules) plus the deterministic deep
 * modules (utility, crosshair placement, positioning, round table) supplied as citable facts.
 */
import {
  POST_MATCH_PROMPT_VERSION,
  POST_MATCH_SYSTEM_PROMPT,
} from "./prompts.js";
import { canaryLine } from "./security.js";

export const DEEP_PROMPT_VERSION = "igl-review-v11-deep";

const DEEP_ADDENDUM = `

DEEP REVIEW (this request is a DEEP review; it extends everything above):
- "deep" contains modules computed in code from the demo and its replay samples. Their numbers are facts: the matching entries in "facts" (ids starting with "deep-") are citable like any other fact. Never cite a deep number that has no fact id; describe it as context instead.
- deep.utility: every grenade you threw (type, round, time, the callout you threw it from, the nearest callout where it landed, enemies/teammates blinded, damage, verdict good/wasted/harmful), efficiency per type (flash: enemies blinded per flash and team-flash rate; HE: damage per grenade; molotov: damage), smokes by callout, unused grenades at death (only when present) and "lineups" (kind "repeat" = your most effective throws; kind "learn" = utility the lobby threw into the callouts where you died). Landing callouts are the nearest callout seen in this match: say "around <callout>".
- deep.crosshair (only when present): at the start of each duel, the angle between your crosshair and the enemy, from the replay sample just before your first shot (8 samples per second, whole degrees). medianOffset, preAimedPct (< 5 degrees), pitchBias (negative = crosshair below head height, positive = above) and worstCallouts. This IS measured crosshair placement for this match, unlike accuracy or hit groups. Small samples (< 8 measured duels) mean low confidence.
- deep.positioning: per death, nearest living teammate distance (units; ~800+ is isolated), whether you were traded within 5 s, how many enemies damaged you in the last 5 s (crossfire) and how long you had held that spot; per-callout aggregates and dangerZones (callouts where you die most).
- deep.rounds: your round table (buy, utility thrown, kills, damage, death, tag highlight/mistake with machine reasons). deep.history (Pro, when present): this match versus your previous deep reviews on this map; say what improved or regressed.
- Structure the review around the deep modules: at least one insight each for utility, crosshair (when present) and positioning when the data supports it, each citing deep facts. 3-8 insights.
- "keyMoments": 5-10 moments from momentCandidates (same rules as above), covering mistakes in the danger zones and your best duels.
- "drills": 3-6, each with "area" = "utility" | "crosshair" | "positioning" | "aim" | "trading" | "economy" | "general". Give concrete routines: utility lineups to learn for this map (name the callouts from "lineups"), crosshair placement routines (e.g. "prefire map or Yprac route clearing at head level", "pre-aim the callouts in worstCallouts"), positioning routines (e.g. "play within trade distance of a teammate", "change spot after a kill"), with a measurable metric this app reports (e.g. "duels pre-aimed (< 5°)", "team-flash rate", "isolated deaths").
- "plan" (max 3) must include the single most important deep finding.
- Deep edge cases: no deep.crosshair (no replay samples or an old match): do not mention crosshair placement as measured; add a caveat that it needs a reprocessed match. No grenades thrown: that is itself the utility finding (say it once, no utility efficiency numbers). No deaths: positioning focuses on how you stayed alive, not danger zones. Empty "lineups": give general utility habits instead of named lineups.`;

export const DEEP_SYSTEM_PROMPT =
  POST_MATCH_SYSTEM_PROMPT.replace(
    "- The data still does NOT contain communication, crosshair placement on video,",
    "- The data still does NOT contain communication, video,",
  ).replace(canaryLine(POST_MATCH_PROMPT_VERSION), "") +
  DEEP_ADDENDUM +
  canaryLine(DEEP_PROMPT_VERSION);
