"use client";
import { useEffect, useState } from "react";
import { useReplayApi } from "../api/context";
import type { ClipRef } from "../model/clip";
import type { ReplayMeta, ReplayWindow } from "../model/replay";

export type ReelItem<C extends ClipRef = ClipRef> = {
  clip: C;
  win: ReplayWindow;
};
type State<C extends ClipRef> =
  | { status: "loading"; loaded: number }
  | { status: "error"; error: string }
  | { status: "ready"; meta: ReplayMeta; items: ReelItem<C>[] };

/** Loads the replay meta once and the window of every reel clip (failed clips are skipped). */
export function useReelClips<C extends ClipRef>(
  analysisId: string,
  clips: C[],
) {
  const api = useReplayApi();
  const [state, setState] = useState<State<C>>({
    status: "loading",
    loaded: 0,
  });
  useEffect(() => {
    let alive = true;
    let loaded = 0;
    setState({ status: "loading", loaded: 0 });
    const meta = api.getMeta(analysisId);
    const wins = clips.map((clip) =>
      api
        .getWindow(analysisId, clip)
        .then((win) => {
          loaded++;
          if (alive) setState({ status: "loading", loaded });
          return { clip, win } as ReelItem<C>;
        })
        .catch(() => null),
    );
    Promise.all([meta, Promise.all(wins)])
      .then(([m, items]) => {
        if (!alive) return;
        const ok = items.filter((x): x is ReelItem<C> => !!x);
        setState(
          ok.length
            ? { status: "ready", meta: m, items: ok }
            : { status: "error", error: "This clip could not be loaded." },
        );
      })
      .catch(
        (e: unknown) =>
          alive &&
          setState({
            status: "error",
            error: e instanceof Error ? e.message : "Request failed.",
          }),
      );
    return () => {
      alive = false;
    };
  }, [api, analysisId, clips]);
  return state;
}
