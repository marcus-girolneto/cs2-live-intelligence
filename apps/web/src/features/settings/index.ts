// Public API of the settings feature (/settings).
export { SettingsApiProvider, useSettingsApi } from "./api/context";
export { createSettingsApi, type SettingsApi } from "./api/settings.api";
export { SettingsScreen } from "./components/SettingsScreen";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
