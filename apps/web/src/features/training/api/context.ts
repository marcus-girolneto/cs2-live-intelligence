"use client";
import { createApiContext } from "@/shared/di";
import { trainingApi, type TrainingApi } from "./training.api";

export const { Provider: TrainingApiProvider, useApi: useTrainingApi } =
  createApiContext<TrainingApi>("TrainingApi", trainingApi);
