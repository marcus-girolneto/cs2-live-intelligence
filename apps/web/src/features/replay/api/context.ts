"use client";
import { createApiContext } from "@/shared/di";
import { replayApi, type ReplayApi } from "./replay.api";

export const { Provider: ReplayApiProvider, useApi: useReplayApi } =
  createApiContext<ReplayApi>("ReplayApi", replayApi);
