"use client";
import { useEffect, useRef, useState } from "react";
import {
  MiniReplay,
  normalizeMeta,
  normalizeWindow,
  type ReplayMeta,
  type ReplayWindow,
} from "@/features/replay";
import { BRAND } from "@/shared/brand";
import { REDUCED_MOTION, useInView, useMediaQuery } from "@/shared/hooks";
import { useI18n } from "@/shared/i18n";
import { Bolt, Brain, Layers } from "@/shared/icons";
import { useTypewriter } from "../hooks/useTypewriter";
import { VERDICT } from "../model/showcase";

type Sample = {
  meta: ReplayMeta;
  win: ReplayWindow;
  focus: string;
  at: number;
};

/** Loaded on demand so the landing's first bundle stays small (~80 KB of JSON). */
async function loadSample(): Promise<Sample | null> {
  const raw = (await import("../fixtures/sample-moment.json")).default as {
    meta: unknown;
    window: unknown;
    focus: string;
    at: number;
  };
  const meta = normalizeMeta(raw.meta);
  const win = normalizeWindow(raw.window);
  return meta && win ? { meta, win, focus: raw.focus, at: raw.at } : null;
}

/** "After the match": a real key moment from the sample match + the coach's verdict typing in. */
export function PostMatchPreview() {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const near = useInView(box, "200px");
  const visible = useInView(box);
  const reduced = useMediaQuery(REDUCED_MOTION);
  const [sample, setSample] = useState<Sample | null>(null);
  useEffect(() => {
    if (!near || sample) return;
    let alive = true;
    void loadSample().then((s) => alive && setSample(s));
    return () => {
      alive = false;
    };
  }, [near, sample]);
  const verdict = useTypewriter(t(VERDICT), visible && !!sample, {
    instant: reduced,
    delayMs: 1600,
  });
  return (
    <div ref={box} className="mode-preview post">
      <div className="mp-stage">
        {sample ? (
          <MiniReplay
            meta={sample.meta}
            win={sample.win}
            focusSteamId={sample.focus}
            at={sample.at}
            label={t(
              "2D replay of a real round from the sample match: a lone player dies at Mid.",
            )}
          />
        ) : (
          <div className="mp-placeholder" aria-hidden />
        )}
        <span className="mp-badge">
          <span className="live-dot" aria-hidden /> {t("Key moment · Round 3")}
        </span>
      </div>
      <div className="mp-coach" aria-live="off">
        <p className="mp-coach-head">
          <Brain size={16} /> {BRAND.coach}
          <span className="mp-tiers">
            <span className="chip">
              <Bolt size={12} /> {t("Quick")}
            </span>
            <span className="chip accent">
              <Layers size={12} /> {t("Deep")}
            </span>
          </span>
        </p>
        <p className="mp-verdict">
          {/* Full text for screen readers; the typed copy is decorative. */}
          <span className="visually-hidden">{t(VERDICT)}</span>
          <span aria-hidden>
            {verdict.shown}
            {!verdict.done && <i className="caret" />}
          </span>
        </p>
      </div>
    </div>
  );
}
