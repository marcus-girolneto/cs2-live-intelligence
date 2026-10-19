"use client";
import { createApiContext } from "@/shared/di";
import { progressApi, type ProgressApi } from "./progress.api";

export const { Provider: ProgressApiProvider, useApi: useProgressApi } =
  createApiContext<ProgressApi>("ProgressApi", progressApi);
