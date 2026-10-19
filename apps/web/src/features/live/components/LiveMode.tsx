"use client";
import { useEffect, useState, type FormEvent } from "react";
import { PlanReminder } from "@/features/maps";
import { useI18n } from "@/shared/i18n";
import { Callout } from "@/shared/ui";
import { useLiveSession } from "../hooks/useLiveSession";
import { useLiveSessions } from "../hooks/useLiveSessions";
import { useSimulator } from "../hooks/useSimulator";
import {
  connectionLabel,
  hudBadge,
  requestedSession,
  DEFAULT_SESSION_ID,
} from "../model/connection";
import { freshness } from "../model/live";
import {
  emptyTracker,
  liveTips,
  trackRound,
  type RoundTracker,
  Baseline,
} from "../model/liveCoach";
import type { LiveTarget } from "../model/types";
import { ConnectGuide } from "./ConnectGuide";
import { Hud } from "./Hud";
import { LiveAiCoach } from "./LiveAiCoach";
import { LiveStatusBar } from "./LiveStatusBar";
import { SessionForm } from "./SessionForm";
/** Live game: session discovery, simulator controls, HUD and the AI IGL panel. */
export function LiveMode({ baseline }: { baseline: Baseline | null }) {
  const { t } = useI18n();
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION_ID);
  const [target, setTarget] = useState<LiveTarget | null>(null);
  const [now, setNow] = useState(Date.now());
  const [tracker, setTracker] = useState<RoundTracker>(emptyTracker());
  const { state, connection, error } = useLiveSession(target);
  // Set when the simulator starts: follow the session that receives data from then on.
  const [followSince, setFollowSince] = useState<number | null>(null);
  const sessions = useLiveSessions(
    target,
    setTarget,
    setSessionId,
    followSince,
  );
  const { sim, simError, simulate } = useSimulator(() => {
    setFollowSince(Date.now() - 1000);
    setTarget(null);
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const requested = requestedSession(window.location.search);
    if (requested) setSessionId(requested);
  }, []);
  useEffect(() => {
    if (state) setTracker((tr) => trackRound(tr, state));
  }, [state]);
  useEffect(() => {
    setTracker(emptyTracker());
    if (target) setFollowSince(null);
  }, [target]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTarget({ id: sessionId.trim(), key: Date.now() });
  }
  const { age, stale } = freshness(state, now, connection);
  const live = connection === "connected" && !!state && !stale;
  const badge = hudBadge(state, live, sim.running);
  const status = connectionLabel(connection, state, stale);
  const latest = sessions?.[0];
  return (
    <>
      {!target && (
        <ConnectGuide
          latest={latest}
          sim={sim}
          simError={simError}
          simulate={simulate}
          onView={(id) => setTarget({ id, key: Date.now() })}
        />
      )}
      {target && (
        <>
          <LiveStatusBar
            status={status}
            live={live}
            warn={stale || connection === "disconnected"}
            age={age}
            hasState={!!state}
            sim={sim}
            simulate={simulate}
          />
          <Hud
            state={state}
            badge={badge}
            rounds={tracker.rounds}
            tips={liveTips(state, tracker.rounds, baseline)}
            baseline={baseline}
            ai={
              <LiveAiCoach
                state={state}
                rounds={tracker.rounds}
                baseline={baseline}
                {...(target ? { sessionId: target.id } : {})}
              />
            }
          />
          <PlanReminder map={state?.map ?? null} />
        </>
      )}
      {error && (
        <Callout tone="error" role="alert">
          {t(error)}
        </Callout>
      )}
      <SessionForm
        sessionId={sessionId}
        setSessionId={setSessionId}
        connected={!!target}
        onSubmit={submit}
        onDisconnect={() => setTarget(null)}
      />
    </>
  );
}
