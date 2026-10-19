/** Kind, player-facing explanation of the welcome credit (never anti-abuse internals). */
import type { Welcome, WelcomeReason } from "./credits";

export type WelcomeCopy = {
  title: string;
  body: string;
  /** How to fix it, when the player can. */
  steps?: string[];
  /** Offer "Refresh my Steam profile". */
  refresh?: boolean;
};

const PENDING: WelcomeCopy = {
  title: "Your free review is on its way",
  body: "We're checking your Steam profile. This usually takes a moment — refresh in a bit.",
  refresh: true,
};
const INELIGIBLE: Record<WelcomeReason, WelcomeCopy | null> = {
  profile_unavailable: PENDING,
  not_evaluated: PENDING,
  disabled: null,
  profile_private: {
    title: "Make your game details public to get your free review",
    body: "We check your Steam profile once to give the free review to real players. Your game details are private right now.",
    steps: [
      "Open Steam → your profile → Edit Profile → Privacy Settings.",
      "Set “My profile” and “Game details” to Public.",
      "Come back and refresh your Steam profile here.",
    ],
    refresh: true,
  },
  account_too_new: {
    title: "Your free review unlocks soon",
    body: "Your Steam account is very new, so the free review isn't available yet. You can still use credit packs or a plan right away.",
  },
  banned: {
    title: "The free review isn't available for this account",
    body: "This Steam account isn't eligible for the welcome credit. Credit packs and plans work as usual.",
  },
  network_limit: {
    title: "The free review was already used here",
    body: "The welcome credit was already claimed from this network. Credit packs and plans work as usual.",
  },
  already_claimed: {
    title: "You already used your free review",
    body: "The welcome credit is one per player. Credit packs and plans give you more reviews.",
  },
  not_steam: {
    title: "Sign in with Steam to get your free review",
    body: "The welcome credit is tied to a Steam account. Local accounts can buy credits or a plan.",
  },
};

/** null when there is nothing to tell the player (welcome credits switched off). */
export function welcomeCopy(w: Welcome): WelcomeCopy | null {
  if (w.status === "granted")
    return {
      title: "You have 1 free review",
      body: "Try the AI coach on the sample match or on your own demo — it's on us.",
    };
  if (w.status === "pending")
    return w.reason === "profile_private"
      ? INELIGIBLE.profile_private
      : PENDING;
  return w.reason
    ? INELIGIBLE[w.reason]
    : {
        title: "The free review isn't available for this account",
        body: "Credit packs and plans work as usual.",
      };
}
