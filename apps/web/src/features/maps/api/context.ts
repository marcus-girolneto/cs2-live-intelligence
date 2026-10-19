"use client";
import { createApiContext } from "@/shared/di";
import { mapsApi, type MapsApi } from "./maps.api";

export const { Provider: MapsApiProvider, useApi: useMapsApi } =
  createApiContext<MapsApi>("MapsApi", mapsApi);
