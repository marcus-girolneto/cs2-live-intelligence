"use client";
import { createApiContext } from "@/shared/di";
import { settingsApi, type SettingsApi } from "./settings.api";

export const { Provider: SettingsApiProvider, useApi: useSettingsApi } =
  createApiContext<SettingsApi>("SettingsApi", settingsApi);
