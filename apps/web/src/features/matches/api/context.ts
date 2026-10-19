"use client";
import { createApiContext } from "@/shared/di";
import { matchesApi, type MatchesApi } from "./matches.api";

export const { Provider: MatchesApiProvider, useApi: useMatchesApi } =
  createApiContext<MatchesApi>("MatchesApi", matchesApi);
