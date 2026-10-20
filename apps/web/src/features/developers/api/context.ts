"use client";
import { createApiContext } from "@/shared/di";
import { developersApi, type DevelopersApi } from "./developers.api";

export const { Provider: DevelopersApiProvider, useApi: useDevelopersApi } =
  createApiContext<DevelopersApi>("DevelopersApi", developersApi);
