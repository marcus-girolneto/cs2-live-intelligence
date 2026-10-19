// Public API of the admin feature (/admin control room, plans editor, user plans).
export { AdminApiProvider, useAdminApi } from "./api/context";
export { createAdminApi, type AdminApi } from "./api/admin.api";
export { AdminScreen } from "./components/AdminScreen";
export { PlansEditor } from "./components/PlansEditor";
export { UserPlanCell } from "./components/UserPlanCell";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
