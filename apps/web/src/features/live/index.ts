// Public API of the live feature (/live second screen).
export { LiveApiProvider, useLiveApi } from "./api/context";
export { createLiveApi, type LiveApi } from "./api/live.api";
export { LiveScreen } from "./components/LiveScreen";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
