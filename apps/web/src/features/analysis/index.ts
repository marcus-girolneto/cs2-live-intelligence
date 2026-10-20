// Public API of the analysis feature (match analysis view and its building blocks).
export { AnalysisApiProvider, useAnalysisApi } from "./api/context";
export { createAnalysisApi, type AnalysisApi } from "./api/analysis.api";
export { AnalysisView } from "./components/AnalysisView";
export { BodyDiagram } from "./components/BodyDiagram";
export { EvidenceDetails } from "./components/EvidenceDetails";
export { KillFeed } from "./components/KillFeed";
export { useAnalysis } from "./hooks/useAnalysis";
export {
  mainSide,
  metricOf,
  metricValue,
  nameMap,
  roundsForEvents,
  type MetricKey,
  type Side,
} from "./model/players";
export type {
  AnalysisResult,
  AuditedAnalysis,
  KillRow,
  Player,
} from "./model/types";
