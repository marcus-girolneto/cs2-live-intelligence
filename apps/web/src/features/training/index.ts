// Public API of the training feature (/training, "Train this" in coach reports).
export { TrainingApiProvider, useTrainingApi } from "./api/context";
export { createTrainingApi, type TrainingApi } from "./api/training.api";
export { PracticeWeekCard } from "./components/PracticeWeekCard";
export { TrainingScreen } from "./components/TrainingScreen";
export { TrainThis } from "./components/TrainThis";
export { isSafeTrainingUrl } from "./model/links";
