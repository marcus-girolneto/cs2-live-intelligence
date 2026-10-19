"use client";
import { createApiContext } from "@/shared/di";
import { authApi, type AuthApi } from "./auth.api";

export const { Provider: AuthApiProvider, useApi: useAuthApi } =
  createApiContext<AuthApi>("AuthApi", authApi);
