"use client";
import { useEffect, useRef, useState } from "react";
import { REDUCED_MOTION, useInView, useMediaQuery } from "@/shared/hooks";
import { useI18n } from "@/shared/i18n";
import { Kevlar, Money, Monitor, Radar, Timer } from "@/shared/icons";
import { useTypewriter } from "../hooks/useTypewriter";
import { IGL_CALL, LIVE_ROUND } from "../model/showcase";

/** Mocked second-screen HUD: a round ends, the score ticks, then the IGL call types out. */
export function LivePreview() {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const visible = useInView(box);
  const reduced = useMediaQuery(REDUCED_MOTION);
  // phase 0 = round being played, 1 = round won (score ticks), 2 = freeze time + call.
  const [phase, setPhase] = useState(0);
  const [freeze, setFreeze] = useState(LIVE_ROUND.freezeSeconds);
  useEffect(() => {
    if (reduced) {
      setPhase(2);
      return;
    }
    if (!visible) return;
    const timers = [
      setTimeout(() => setPhase(1), 1200),
      setTimeout(() => setPhase(2), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible, reduced]);
  useEffect(() => {
    if (phase !== 2 || reduced || !visible) return;
    const id = setInterval(
      () => setFreeze((s) => (s <= 1 ? LIVE_ROUND.freezeSeconds : s - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [phase, reduced, visible]);
  const call = useTypewriter(t(IGL_CALL), visible && phase === 2, {
    instant: reduced,
    delayMs: 400,
  });
  const s = phase === 0 ? LIVE_ROUND.before : LIVE_ROUND.after;
  return (
    <div ref={box} className="mode-preview live">
      <div className="lp-hud">
        <header className="lp-top">
          <span className="lp-label">
            <Monitor size={14} /> {t("Second screen")}
          </span>
          <span className={`lp-phase ${phase === 2 ? "freeze" : ""}`}>
            {phase === 2 ? (
              <>
                <Timer size={14} /> {t("Freeze time")} 0:
                {String(freeze).padStart(2, "0")}
              </>
            ) : (
              <>
                <span className="live-dot" aria-hidden /> {t("Live")}
              </>
            )}
          </span>
        </header>
        <div className="lp-score" aria-label={t("Scoreboard")}>
          <b className={`ct ${phase >= 1 ? "tick" : ""}`}>{s.ct}</b>
          <span>
            {t("Round {n}", {
              n: phase >= 1 ? LIVE_ROUND.round : LIVE_ROUND.round - 1,
            })}
          </span>
          <b className="t">{s.t}</b>
        </div>
        <dl className="lp-stats">
          <div>
            <dt>K / D</dt>
            <dd className={phase >= 1 ? "tick" : ""}>
              {s.kills} / {s.deaths}
            </dd>
          </div>
          <div>
            <dt>
              <Money size={12} /> {t("Money")}
            </dt>
            <dd>${LIVE_ROUND.money.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>
              <Kevlar size={12} /> {t("Armor")}
            </dt>
            <dd>0</dd>
          </div>
        </dl>
        {phase === 1 && (
          <p className="lp-banner" role="status">
            {t("Round won")}
          </p>
        )}
      </div>
      <div className={`lp-call ${phase === 2 ? "on" : ""}`}>
        <p className="lp-call-head">
          <Radar size={16} /> {t("IGL call")}
          <small>{t("between rounds only")}</small>
        </p>
        <p className="lp-call-text">
          <span className="visually-hidden">{t(IGL_CALL)}</span>
          <span aria-hidden>
            {phase === 2 ? call.shown : ""}
            {phase === 2 && !call.done && <i className="caret" />}
          </span>
        </p>
      </div>
    </div>
  );
}
