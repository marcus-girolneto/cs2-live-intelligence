"use client";
import type { LiveCallResult as Result } from "../model/types";
import type { LiveState } from "@cs2/contracts";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { planLimitFrom, useUpgrade, useUsage } from "@/features/billing";
import { BRAND } from "@/shared/brand";
import { ApiError } from "@/shared/http";
import { useI18n } from "@/shared/i18n";
import { Brain, Crown, Lock } from "@/shared/icons";
import { CrosshairLoader } from "@/shared/ui";
import { useLiveApi } from "../api/context";
import type { Baseline, RoundRecord } from "../model/liveCoach";
const AUTO_KEY = "cs2.liveAi.auto";
const readAuto = () => {
  try {
    return window.localStorage.getItem(AUTO_KEY) !== "false";
  } catch {
    return true;
  }
};

/**
 * IGL-style AI call between rounds. Auto mode asks once per completed round; the model is
 * never called during live action (the server enforces this too).
 */
export function LiveAiCoach({
  state,
  rounds,
  baseline,
  sessionId,
  analysisId,
}: {
  state: LiveState | null;
  rounds: RoundRecord[];
  baseline: Baseline | null;
  /** Live sessions: the server reads its own authoritative state. Replays send the frame. */
  sessionId?: string;
  /** Replays: the analysed match, so all calls of one replay count as one match. */
  analysisId?: string;
}) {
  const { t, lang } = useI18n();
  const api = useLiveApi();
  const [auto, setAuto] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [limited, setLimited] = useState(false);
  const asked = useRef<string | null>(null);
  const { usage, limits, isAdmin } = useUsage();
  const upgrade = useUpgrade();
  // Free plan: rule-based tips only (the API answers 402 too).
  const locked =
    !isAdmin &&
    (usage?.liveAiMatches
      ? usage.liveAiMatches.limit === 0
      : limits?.liveAiMatchesPerDay === 0);
  useEffect(() => setAuto(readAuto()), []);
  const between = !!state && state.phase !== "live";
  const ask = useCallback(
    (key: string) => {
      if (!state || asked.current === key || locked || limited) return;
      asked.current = key;
      setBusy(true);
      setError(null);
      api
        .liveCall({
          state,
          rounds,
          baseline,
          lang,
          ...(sessionId ? { sessionId } : {}),
          ...(analysisId ? { analysisId } : {}),
        })
        .then(setResult)
        .catch((e: unknown) => {
          if (planLimitFrom(e)) {
            setLimited(true);
            if (key.startsWith("manual:")) upgrade.handle(e);
            return;
          }
          setError(
            e instanceof ApiError
              ? { message: e.message, ...(e.code ? { code: e.code } : {}) }
              : { message: e instanceof Error ? e.message : "Request failed." },
          );
        })
        .finally(() => setBusy(false));
    },
    [
      state,
      sessionId,
      analysisId,
      rounds,
      baseline,
      lang,
      locked,
      limited,
      upgrade,
      api,
    ],
  );
  // Auto: one call per completed round, only between rounds.
  const lastRound = rounds.at(-1)?.round;
  useEffect(() => {
    if (auto && between && lastRound !== undefined) ask(`auto:${lastRound}`);
  }, [auto, between, lastRound, ask]);
  function toggle(next: boolean) {
    setAuto(next);
    try {
      window.localStorage.setItem(AUTO_KEY, String(next));
    } catch {
      /* preference not remembered */
    }
  }
  if (locked || limited)
    return (
      <section className="hud-ai locked" aria-label={BRAND.igl}>
        <header>
          <h3>
            <Lock size={18} /> {BRAND.igl}
          </h3>
          <span className="chip accent">{t("Basic and Pro")}</span>
        </header>
        <p className="muted small">
          {limited && !locked
            ? t(
                "You used today's live AI matches. Rule-based tips keep running.",
              )
            : t(
                "Live AI calls between rounds are part of Basic and Pro. The rule-based tips above stay free.",
              )}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() =>
            upgrade.open({
              feature: "live_ai",
              limit: locked ? 0 : (usage?.liveAiMatches?.limit ?? null),
              ...(usage?.resetsAt ? { resetsAt: usage.resetsAt } : {}),
            })
          }
        >
          <Crown size={16} /> {t("Get the AI IGL")}
        </button>
      </section>
    );
  return (
    <section className="hud-ai" aria-label={BRAND.igl}>
      <header>
        <h3>
          <Brain size={20} /> {BRAND.igl}
        </h3>
        <label className="check small">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => toggle(e.target.checked)}
          />
          {t("Call every round")}
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!between || busy}
          onClick={() => ask(`manual:${Date.now()}`)}
          title={between ? undefined : t("Available between rounds")}
        >
          {busy && <CrosshairLoader size={16} />}
          {busy ? t("Thinking…") : t("Ask now")}
        </button>
      </header>
      {!between && !result && (
        <p className="muted small">
          {t("The {igl} speaks between rounds, never during a fight.", {
            igl: BRAND.igl,
          })}
        </p>
      )}
      {error?.code === "ai_not_configured" ? (
        <p className="muted small">
          {t("The IGL is offline right now.")}{" "}
          {isAdmin && <Link href="/admin">{t("Open AI settings")}</Link>}
        </p>
      ) : (
        error && (
          <p role="alert" className="form-error">
            {error.message}
          </p>
        )
      )}
      {result && (
        <div className="ai-call" data-testid="ai-live-call">
          <span className={`focus-chip ${result.call.focus}`}>
            {t(result.call.focus)}
          </span>
          <strong>{result.call.call}</strong>
          <p>{result.call.why}</p>
          <small className="muted">
            {t("Confidence: {level}", { level: t(result.call.confidence) })}
          </small>
        </div>
      )}
    </section>
  );
}
