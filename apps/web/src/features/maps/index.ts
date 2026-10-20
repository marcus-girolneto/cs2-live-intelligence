// Public API of the maps feature: progress data, map badges, per-map progress and plans.
export { MapsApiProvider, useMapsApi } from "./api/context";
export { createMapsApi, mapsApi, type MapsApi } from "./api/maps.api";
export { MapBadge } from "./components/MapBadge";
export { MapPlanPanel } from "./components/MapPlanPanel";
export { MapProgressView } from "./components/MapProgressView";
export { MapSwitcher } from "./components/MapSwitcher";
export { PlanList } from "./components/PlanList";
export { PlanReminder } from "./components/PlanReminder";
export { useCoachProgress } from "./hooks/useCoachProgress";
export {
  generalPlanOf,
  mapKey,
  mapLabel,
  mapsOf,
  metricsOf,
  planFor,
  type MapProgress,
} from "./model/maps";
export {
  byScope,
  parsePlan,
  scopeOf,
  type PlanItem,
  type Scope,
} from "./model/plan";
export {
  PROGRESS_METRICS,
  type LearnedMetric,
  type LiveCallRecord,
  type Progress,
  type Review,
  type TimelineEntry,
} from "./model/progress";
export { finalScore, formatScore } from "./model/score";
