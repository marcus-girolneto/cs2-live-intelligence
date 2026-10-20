"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Account } from "./account";

export type AccountContextValue = {
  account: Account | null;
  /** Re-reads the account (GET me), e.g. after a plan or profile change. */
  refresh: () => Promise<void>;
};
const AccountContext = createContext<AccountContextValue>({
  account: null,
  refresh: async () => {},
});

export function AccountProvider({
  value,
  children,
}: {
  value: AccountContextValue;
  children: ReactNode;
}) {
  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}
export const useAccount = () => useContext(AccountContext);
