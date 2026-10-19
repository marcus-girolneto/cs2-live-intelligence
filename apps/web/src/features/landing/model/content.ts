import { Brain, Upload, SignInMark } from "@/shared/icons";
export const STEPS = [
  {
    icon: SignInMark,
    title: "Sign in with Steam",
    text: "One click. We only receive your public SteamID — never your password.",
  },
  {
    icon: Upload,
    title: "Drop a demo",
    text: "Upload your .dem or load a real sample match. Parsed in seconds.",
  },
  {
    icon: Brain,
    title: "Get your plan",
    text: "Hit groups, weapons, callouts, timing — and an AI review with a plan for your next match.",
  },
] as const;

export const FAQ = [
  {
    q: "Is it free?",
    a: "Yes. Sign in with Steam and analyze your demos at no cost.",
  },
  {
    q: "Is this a cheat?",
    a: "No. It only reads demos after the match and your own game state on a second screen. Nothing is injected into the game and the coach never gives information you could not see.",
  },
  {
    q: "What do you get from my Steam account?",
    a: "Only your public SteamID and public profile (name, avatar). Steam handles the sign-in; we never see your password.",
  },
  {
    q: "Where do I find my demos?",
    a: "In CS2 open Watch → Your Matches and download the match. The .dem file is saved in game/csgo/replays.",
  },
] as const;
