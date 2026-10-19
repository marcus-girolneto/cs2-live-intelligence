"use client";
import { useEffect, useState } from "react";
import type { LiveSessionDto } from "@/shared/api-types";
import { useLiveApi } from "../api/context";
import { pickSession, sortSessions } from "../model/connection";
import type { LiveTarget } from "../model/types";

/**
 * Polls the session list every 2 s while disconnected so the page attaches by itself once
 * data arrives. Only sessions that sent data recently are auto-connected; with `since`, only
 * those that received data after that moment (the simulator was just started).
 */
export function useLiveSessions(
  target: LiveTarget | null,
  setTarget: (t: LiveTarget) => void,
  setSessionId: (id: string) => void,
  since: number | null = null,
) {
  const api = useLiveApi();
  const [sessions, setSessions] = useState<LiveSessionDto[] | null>(null);
  useEffect(() => {
    if (target) return;
    let first = true;
    function poll() {
      api
        .listSessions()
        .then((list) => {
          const sorted = sortSessions(list);
          setSessions(sorted);
          const latest = sorted[0];
          if (
            first &&
            latest &&
            !new URLSearchParams(window.location.search).get("sessionId")
          )
            setSessionId(latest.sessionId);
          first = false;
          const pick = pickSession(sorted, Date.now(), since);
          if (pick) setTarget({ id: pick.sessionId, key: Date.now() });
        })
        .catch(() => setSessions((s) => s ?? []));
    }
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [api, target, setTarget, setSessionId, since]);
  return sessions;
}
