"use client";
import { createApiContext } from "@/shared/di";
import { personalApi, type PersonalApi } from "./personal.api";

export const { Provider: PersonalApiProvider, useApi: usePersonalApi } =
  createApiContext<PersonalApi>("PersonalApi", personalApi);
