// Public API of the replay feature (2D clip player, "cortes").
export { ReplayApiProvider, useReplayApi } from "./api/context";
export { createReplayApi, type ReplayApi } from "./api/replay.api";
export {
  ClipPlayerDialog,
  type ClipPlayerProps,
} from "./components/ClipPlayer";
export { canExportVideo } from "./hooks/useClipPlayer";
export { MAX_CLIP_SECONDS, parseClip, type ClipRef } from "./model/clip";
export { mockCoaching, mockMeta, mockWindow } from "./model/mock";
export {
  normalizeMeta,
  normalizeWindow,
  type ReplayMeta,
  type ReplayWindow,
} from "./model/replay";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
