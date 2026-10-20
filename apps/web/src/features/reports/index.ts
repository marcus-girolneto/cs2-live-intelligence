// Public API of the reports feature (/reports, monthly performance report, Pro).
export { ReportsApiProvider, useReportsApi } from "./api/context";
export { createReportsApi, type ReportsApi } from "./api/reports.api";
export { ReportsScreen } from "./components/ReportsScreen";
export {
  normalizeReport,
  normalizeReportList,
  type Report,
} from "./model/report";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
