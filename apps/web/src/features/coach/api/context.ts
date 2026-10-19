"use client";
import { createApiContext } from "@/shared/di";
import { coachApi, type CoachApi } from "./coach.api";

export const { Provider: CoachApiProvider, useApi: useCoachApi } =
  createApiContext<CoachApi>("CoachApi", coachApi);
