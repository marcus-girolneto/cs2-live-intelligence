// Public API of the matches feature: history, upload, sample demo and match rows.
export { MatchesApiProvider, useMatchesApi } from "./api/context";
export { createMatchesApi, type MatchesApi } from "./api/matches.api";
export { DemoScreen } from "./components/DemoScreen";
export { HistoryScreen } from "./components/HistoryScreen";
export { MatchRow } from "./components/MatchRow";
export { SampleImport } from "./components/SampleImport";
export { StatusPill } from "./components/StatusPill";
export { UploadScreen } from "./components/UploadScreen";
export { PENDING, type MatchSummary } from "./model/status";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
