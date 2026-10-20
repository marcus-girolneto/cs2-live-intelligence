"use client";
import type { PlayerView } from "../model/playerView";
import { useEffect, useMemo, useState } from "react";
import { finite, mapName, text } from "@/shared/format";
import { useI18n } from "@/shared/i18n";
import { loadMe, type Me, useAccount } from "@/shared/session";
import {
  BODY_REGIONS,
  playerInsight,
  type BodyRegion,
} from "../model/insight/index";
import { mean } from "../model/metrics";
import { mainSide, metricValue, nameMap } from "../model/players";
import type { AnalysisResult } from "../model/types";
import { useMatchExtras } from "./useMatchExtras";
export type Tab = "overview" | "aim" | "map" | "rounds" | "coach" | "data";

/** State and match-wide derived data of the analysis screen (players, references, selection). */
export function useAnalysisView(result: AnalysisResult) {
  const { t } = useI18n();
  const { analysis } = result;
  const events = useMemo(() => analysis.events ?? [], [analysis.events]);
  const names = useMemo(
    () => nameMap(analysis.players, (n) => t("Player {n}", { n })),
    [analysis.players, t],
  );
  const players = useMemo(
    () =>
      analysis.players
        .filter((p) => text(p.steamId))
        .map((p) => ({
          ...p,
          side: mainSide(p, events),
          start: p.rounds?.find((r) => r.side)?.side ?? mainSide(p, events),
        }))
        .sort(
          (a, b) =>
            (metricValue(b, "adr") ?? -1) - (metricValue(a, "adr") ?? -1),
        ),
    [analysis.players, events],
  );
  const insights = useMemo(
    () => new Map(players.map((p) => [p.steamId, playerInsight(p, events)])),
    [players, events],
  );
  const [me, setMe] = useState<Me | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("overview");
  const [focusRounds, setFocusRounds] = useState<number[]>([]);
  const [accountSteamId, setAccountSteamId] = useState<string | null>(null);
  const { account } = useAccount();
  useEffect(() => {
    const stored = loadMe();
    setMe(stored);
    if (
      stored?.analysisId === result.id &&
      players.some((p) => p.steamId === stored.steamId)
    )
      setSelectedId(stored.steamId);
    const own = account?.steamId;
    if (own && players.some((p) => p.steamId === own)) {
      setAccountSteamId(own);
      setSelectedId(own);
    }
  }, [result.id, players, account?.steamId]);
  const player = players.find((p) => p.steamId === selectedId) ?? players[0];
  const extras = useMatchExtras(result.id, player?.steamId ?? null);
  const rounds = (analysis.roundOutcomes ?? []).filter(
    (r) => finite(r.round) !== null,
  );
  const wins = {
    CT: rounds.filter((r) => r.winner === "CT").length,
    T: rounds.filter((r) => r.winner === "T").length,
  };
  // Match-wide references so every number has context.
  const refs = useMemo(() => {
    const all = [...insights.values()];
    const share: Partial<Record<BodyRegion, number | null>> = {};
    for (const r of BODY_REGIONS)
      share[r] = mean(
        all.map((i) =>
          i.hitgroups && i.hitTotal > 0
            ? (i.hitgroups[r] / i.hitTotal) * 100
            : null,
        ),
      );
    return {
      accuracy: mean(all.map((i) => i.accuracy)),
      share,
      opening: mean(all.map((i) => i.timing?.avgOpeningTime)),
      death: mean(all.map((i) => i.timing?.avgDeathTime)),
      adr: mean(players.map((p) => metricValue(p, "adr"))),
      kd: mean(
        players.map((p) => {
          const k = metricValue(p, "kills");
          const d = metricValue(p, "deaths");
          return k !== null && d !== null && d > 0 ? k / d : null;
        }),
      ),
      kast: mean(players.map((p) => metricValue(p, "kast"))),
      hs: mean(players.map((p) => metricValue(p, "headshotPercentage"))),
    };
  }, [insights, players]);
  const ghosts = useMemo(
    () =>
      events.flatMap((e) =>
        e.type === "kill"
          ? [e.attackerPos, e.victimPos].filter(
              (p): p is { x: number; y: number; z: number } =>
                !!p && Number.isFinite(p.x) && Number.isFinite(p.y),
            )
          : [],
      ),
    [events],
  );
  const map = mapName(analysis.map);
  return {
    lobby: extras.lobby,
    integrity: extras.integrity,
    flagged: extras.flagged,
    analysis,
    events,
    names,
    players,
    insights,
    me,
    setMe,
    selectedId,
    setSelectedId,
    tab,
    setTab,
    focusRounds,
    setFocusRounds,
    accountSteamId,
    account,
    player,
    rounds,
    wins,
    refs,
    ghosts,
    map,
  };
}
export type AnalysisBase = ReturnType<typeof useAnalysisView>;
export type SelectedPlayer = AnalysisBase["players"][number];
export type AnalysisVM = Omit<AnalysisBase, "player"> &
  PlayerView & {
    player: SelectedPlayer;
    goRound: (rounds: number[]) => void;
    idBase: string;
    resultId: string;
  };
