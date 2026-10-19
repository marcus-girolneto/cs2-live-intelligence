"use client";
import { createApiContext } from "@/shared/di";
import { liveApi, type LiveApi } from "./live.api";

export const { Provider: LiveApiProvider, useApi: useLiveApi } =
  createApiContext<LiveApi>("LiveApi", liveApi);
