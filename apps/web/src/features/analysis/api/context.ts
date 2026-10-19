"use client";
import { createApiContext } from "@/shared/di";
import { analysisApi, type AnalysisApi } from "./analysis.api";

export const { Provider: AnalysisApiProvider, useApi: useAnalysisApi } =
  createApiContext<AnalysisApi>("AnalysisApi", analysisApi);
