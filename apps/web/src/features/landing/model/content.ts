import {
  Brain,
  Clock,
  Crosshair,
  Headshot,
  Skull,
  Upload,
  SignInMark,
} from "@/shared/icons";
export const PAINS = [
  {
    icon: Skull,
    tone: "bad",
    quote: "4 of your 6 deaths were at Top of Mid in the first 20 seconds.",
    fix: "Stop dry-peeking mid on the default. Take it with a flash or a trade partner.",
  },
  {
    icon: Crosshair,
    tone: "bad",
    quote: "AK-47 accuracy 14% vs 31% with the M4A1-S.",
    fix: "You spray the AK too long. Burst at range and reset.",
  },
  {
    icon: Headshot,
    tone: "warn",
    quote: "62% of your hits land on the legs and stomach.",
    fix: "Your crosshair sits too low. Pre-aim head height on every angle.",
  },
  {
    icon: Clock,
    tone: "good",
    quote: "You win 3 of 4 opening duels when you peek after 25 seconds.",
    fix: "Your late timing works. Keep lurking for the second pick.",
  },
] as const;

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
