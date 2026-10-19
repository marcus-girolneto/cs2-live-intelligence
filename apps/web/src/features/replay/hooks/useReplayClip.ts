"use client";
import { useEffect, useState } from "react";
import { useReplayApi } from "../api/context";
import type { ClipRef } from "../model/clip";
import type { ReplayMeta, ReplayWindow } from "../model/replay";

const metaCache = new Map<string, Promise<ReplayMeta>>();
type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; meta: ReplayMeta; win: ReplayWindow };

/** Loads the (cached) replay meta of a match and the window of one clip. */
export function useReplayClip(analysisId: string, clip: ClipRef): State {
  const api = useReplayApi();
  const [state, setState] = useState<State>({ status: "loading" });
  const { round, from, to } = clip;
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    let meta = metaCache.get(analysisId);
    if (!meta) {
      meta = api.getMeta(analysisId);
      metaCache.set(analysisId, meta);
      meta.catch(() => metaCache.delete(analysisId));
    }
    Promise.all([meta, api.getWindow(analysisId, { round, from, to })])
      .then(([m, win]) => alive && setState({ status: "ready", meta: m, win }))
      .catch(
        (e) =>
          alive &&
          setState({
            status: "error",
            error: e instanceof Error ? e.message : "Request failed.",
          }),
      );
    return () => {
      alive = false;
    };
  }, [api, analysisId, round, from, to]);
  return state;
}
