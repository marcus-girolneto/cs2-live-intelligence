"use client";
import { formatNumber } from "@/shared/format";
import { GlossaryButton, Term } from "@/shared/glossary";
import { useI18n } from "@/shared/i18n";
import {
  Brain,
  Chart,
  Database,
  MapPin,
  Radar,
  Target,
  Trophy,
} from "@/shared/icons";
import { saveMe, type Me } from "@/shared/session";
import { SideTag, TabPanel, Tabs, type TabDef } from "@/shared/ui";
import { useAnalysisApi } from "../api/context";
import { useAnalysisView, Tab, AnalysisVM } from "../hooks/useAnalysisView";
import { playerView } from "../model/playerView";
import type { AnalysisResult } from "../model/types";
import { AiCoach } from "./AiCoach";
import { MatchHero } from "./MatchHero";
import { PlayerPicker } from "./PlayerPicker";
import { AimTab } from "./tabs/AimTab";
import { DataTab } from "./tabs/DataTab";
import { MapTab } from "./tabs/MapTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { RoundsTab } from "./tabs/RoundsTab";
export function AnalysisView({ result }: { result: AnalysisResult }) {
  const { t, locale } = useI18n();
  const num = (v: unknown, d = 0) => formatNumber(v, d, locale);
  const api = useAnalysisApi();
  const base = useAnalysisView(result);
  const { analysis, setMe, tab, setTab, setFocusRounds, account } = base;
  const player = base.player;
  if (!player)
    return (
      <p className="empty">
        {t("This analysis has no players with valid data.")}
      </p>
    );
  const pv = playerView(base, result.id, player);
  const { insight, name, kills, deaths, kd, adr, hs, rows, isMe, isYou, top } =
    pv;
  function markMe() {
    const next: Me | null = isMe
      ? null
      : {
          analysisId: result.id,
          steamId: player!.steamId,
          name,
          ...(analysis.map ? { map: analysis.map } : {}),
          kills,
          deaths,
          rounds: rows.length || null,
        };
    saveMe(next);
    setMe(next);
    if (!account?.steamId)
      void api
        .setCoachPlayer(next ? next.steamId : null)
        .catch(() => undefined);
  }
  const goRound = (r: number[]) => {
    setFocusRounds(r);
    setTab("rounds");
  };
  const tabs: TabDef<Tab>[] = [
    { id: "overview", label: t("Overview"), icon: <Radar /> },
    { id: "aim", label: t("Aim"), icon: <Target /> },
    { id: "map", label: t("Map"), icon: <MapPin /> },
    { id: "rounds", label: t("Rounds"), icon: <Chart /> },
    { id: "coach", label: t("AI Coach"), icon: <Brain /> },
    { id: "data", label: t("Data & sources"), icon: <Database /> },
  ];
  const idBase = `an-${result.id.slice(0, 8)}`;
  const vm: AnalysisVM = {
    ...base,
    ...pv,
    player,
    goRound,
    idBase,
    resultId: result.id,
  };
  return (
    <div className="analysis">
      <MatchHero vm={vm} />

      <div className="analysis-grid">
        <PlayerPicker vm={vm} />

        <section className="player-detail">
          <header className="player-head">
            <div className="ph-id">
              <span className={`ph-badge ${player.side?.toLowerCase() ?? ""}`}>
                {name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <div className="ph-tags">
                  <SideTag side={player.side} />
                  {isYou && <span className="badge">{t("You")}</span>}
                  {top && (
                    <span className="badge mvp">
                      <Trophy size={14} /> {t("Most damage in the match")}
                    </span>
                  )}
                </div>
                <h3>{name}</h3>
              </div>
            </div>
            <div className="ph-actions">
              <GlossaryButton />
              {!account?.steamId && (
                <button
                  type="button"
                  className={`btn btn-sm ${isMe ? "btn-primary" : "btn-ghost"}`}
                  onClick={markMe}
                  aria-pressed={isMe}
                >
                  {isMe ? t("This is me ✓") : t("This is me")}
                </button>
              )}
            </div>
          </header>
          <div className="ph-strip">
            <span>
              <b>{num(kills) ?? "—"}</b>
              <small>{t("Kills")}</small>
            </span>
            <span>
              <b>{num(deaths) ?? "—"}</b>
              <small>{t("Deaths")}</small>
            </span>
            <span>
              <b
                className={kd !== null ? (kd >= 1 ? "good" : "bad") : undefined}
              >
                {num(kd, 2) ?? "—"}
              </b>
              <small>
                <Term id="kd">K/D</Term>
              </small>
            </span>
            <span>
              <b>{num(adr, 1) ?? "—"}</b>
              <small>
                <Term id="adr">ADR</Term>
              </small>
            </span>
            <span>
              <b>{hs !== null ? `${num(hs)}%` : "—"}</b>
              <small>
                <Term id="hs">HS%</Term>
              </small>
            </span>
            <span>
              <b>
                {insight.accuracy !== null ? `${num(insight.accuracy)}%` : "—"}
              </b>
              <small>
                <Term id="accuracy">{t("Accuracy")}</Term>
              </small>
            </span>
          </div>

          <Tabs
            tabs={tabs}
            value={tab}
            onChange={setTab}
            label={t("Analysis sections")}
            idBase={idBase}
            className="analysis-tabs"
          />

          {tab === "overview" && <OverviewTab vm={vm} />}
          {tab === "aim" && <AimTab vm={vm} />}
          {tab === "map" && <MapTab vm={vm} />}
          {tab === "coach" && (
            <TabPanel idBase={idBase} id="coach">
              <AiCoach
                analysisId={result.id}
                steamId={player.steamId}
                name={name}
              />
            </TabPanel>
          )}
          {tab === "rounds" && <RoundsTab vm={vm} />}
          {tab === "data" && <DataTab vm={vm} />}
        </section>
      </div>
    </div>
  );
}
