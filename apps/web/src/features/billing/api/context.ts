"use client";
import { createApiContext } from "@/shared/di";
import { billingApi, type BillingApi } from "./billing.api";

export const { Provider: BillingApiProvider, useApi: useBillingApi } =
  createApiContext<BillingApi>("BillingApi", billingApi);
