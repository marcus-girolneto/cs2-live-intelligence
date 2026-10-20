// Public API of the personal feature (/coach/personal, Personal Coach, Pro).
export { PersonalApiProvider, usePersonalApi } from "./api/context";
export { createPersonalApi, type PersonalApi } from "./api/personal.api";
export { PersonalCoachCard } from "./components/PersonalCoachCard";
export { PersonalCoachScreen } from "./components/PersonalCoachScreen";
export {
  normalizePersonal,
  type PersonalPlan,
  type PersonalState,
} from "./model/personal";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
