"use client";
import { createApiContext } from "@/shared/di";
import { reportsApi, type ReportsApi } from "./reports.api";

export const { Provider: ReportsApiProvider, useApi: useReportsApi } =
  createApiContext<ReportsApi>("ReportsApi", reportsApi);
