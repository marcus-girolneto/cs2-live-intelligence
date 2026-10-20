// Public API of the training feature (/training, "Train this" in coach reports).
export { TrainingApiProvider, useTrainingApi } from "./api/context";
export { createTrainingApi, type TrainingApi } from "./api/training.api";
export { PracticeWeekCard } from "./components/PracticeWeekCard";
export { TrainingScreen } from "./components/TrainingScreen";
export { TrainThis } from "./components/TrainThis";
export { isSafeTrainingUrl } from "./model/links";
/** Portuguese dictionary of this feature (merged by src/composition/i18n.ts). */
export { pt as i18nPt } from "./i18n/pt";
