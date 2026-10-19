import type { Account } from "./account";

/** Persona name, else "Steam 1234", else the given fallback. */
export function displayName(account: Account, fallback: string) {
  return (
    account.profile?.personaName?.trim() ||
    (account.steamId ? `Steam ${account.steamId.slice(-4)}` : fallback)
  );
}
