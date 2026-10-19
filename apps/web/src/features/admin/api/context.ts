"use client";
import { createApiContext } from "@/shared/di";
import { adminApi, type AdminApi } from "./admin.api";

export const { Provider: AdminApiProvider, useApi: useAdminApi } =
  createApiContext<AdminApi>("AdminApi", adminApi);
