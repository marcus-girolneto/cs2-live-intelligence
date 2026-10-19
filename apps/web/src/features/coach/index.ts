// Public API of the coach feature (/coach screen and the compact analysis tab).
export { CoachPreview } from "./components/CoachPreview";
export { CoachScreen } from "./components/CoachScreen";
export { ReelButton } from "./components/ReelButton";
export { useSavedReview } from "./hooks/useSavedReview";
export {
  byScope,
  normalizeCoaching,
  parsePlan,
  type ClipRef,
  type CoachReview,
  type PlanItem,
  type ReviewTier,
} from "./model/coaching";
export { normalizeDeep, type DeepReview } from "./model/deep";
export { CoachApiProvider, useCoachApi } from "./api/context";
export { createCoachApi, type CoachApi } from "./api/coach.api";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
