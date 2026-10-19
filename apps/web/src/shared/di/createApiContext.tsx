"use client";
import { createContext, useContext, type ReactNode } from "react";

/**
 * Dependency-injection slot for one feature API. Hooks read the API with `useApi()`
 * and get the default (HTTP) implementation unless a Provider above them supplies
 * another one — tests and stories pass fakes this way.
 */
export function createApiContext<T>(name: string, fallback: T) {
  const Ctx = createContext<T>(fallback);
  Ctx.displayName = name;
  function Provider({ value, children }: { value: T; children: ReactNode }) {
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }
  const useApi = () => useContext(Ctx);
  return { Provider, useApi };
}
