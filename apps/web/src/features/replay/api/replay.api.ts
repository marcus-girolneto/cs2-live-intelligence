import { platformHttp, seg, type HttpClient } from "@/shared/http";
import type { ClipRef } from "../model/clip";
import {
  normalizeMeta,
  normalizeWindow,
  type ReplayMeta,
  type ReplayWindow,
} from "../model/replay";

/** Replay data of a stored analysis (meta per match, position windows per clip). */
export interface ReplayApi {
  getMeta(analysisId: string): Promise<ReplayMeta>;
  getWindow(
    analysisId: string,
    clip: Pick<ClipRef, "round" | "from" | "to">,
  ): Promise<ReplayWindow>;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export function createReplayApi(http: HttpClient = platformHttp): ReplayApi {
  return {
    async getMeta(analysisId) {
      const meta = normalizeMeta(
        await http.get<unknown>(`analyses/${seg(analysisId)}/replay/meta`),
      );
      if (!meta) throw new Error("This match has no replay data.");
      return meta;
    },
    async getWindow(analysisId, clip) {
      const win = normalizeWindow(
        await http.get<unknown>(`analyses/${seg(analysisId)}/replay`, {
          query: {
            round: String(clip.round),
            from: fmt(clip.from),
            to: fmt(clip.to),
          },
        }),
      );
      if (!win) throw new Error("This clip has no positions to replay.");
      return win;
    },
  };
}
export const replayApi = createReplayApi();
