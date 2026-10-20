/** Outcome of a Steam login the API redirected back with (`/?signin=failed|unavailable`). */
export type SigninStatus = "failed" | "unavailable";

/** Reads `signin` from a query string; anything unknown is ignored. */
export function signinStatusOf(search: string): SigninStatus | null {
  const v = new URLSearchParams(search).get("signin");
  return v === "failed" || v === "unavailable" ? v : null;
}

/** The same URL without the `signin` param (keeps other params and the hash). */
export function withoutSigninParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("signin");
  return `${url.pathname}${url.search}${url.hash}`;
}

export const SIGNIN_MESSAGE: Record<SigninStatus, string> = {
  failed:
    "Steam sign-in didn't complete. Please try again — use a single tab and click Sign in once.",
  unavailable: "Steam is not responding right now. Try again in a minute.",
};
