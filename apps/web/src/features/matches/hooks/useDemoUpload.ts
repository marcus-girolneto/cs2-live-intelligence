"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMatchesApi } from "../api/context";
import {
  etaSeconds,
  pushSample,
  uploadRate,
  type Sample,
} from "../model/upload";

export type UploadState = {
  loaded: number;
  total: number;
  /** Bytes per second, null until measured. */
  rate: number | null;
  eta: number | null;
};

const isAbort = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";

/** Uploads a demo with live progress, speed and ETA; `cancel()` aborts it. */
export function useDemoUpload() {
  const api = useMatchesApi();
  const [progress, setProgress] = useState<UploadState | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const samples = useRef<Sample[]>([]);
  useEffect(() => () => ctrl.current?.abort(), []);
  const start = useCallback(
    async (file: File): Promise<{ id: string } | "cancelled"> => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      samples.current = [{ at: Date.now(), loaded: 0 }];
      setProgress({ loaded: 0, total: file.size, rate: null, eta: null });
      try {
        const result = await api.uploadDemo(file, {
          signal: c.signal,
          onProgress: ({ loaded, total }) => {
            samples.current = pushSample(samples.current, {
              at: Date.now(),
              loaded,
            });
            const rate = uploadRate(samples.current);
            setProgress({
              loaded,
              total,
              rate,
              eta: etaSeconds(loaded, total, rate),
            });
          },
        });
        return result;
      } catch (e) {
        setProgress(null);
        if (isAbort(e)) return "cancelled";
        throw e;
      } finally {
        if (ctrl.current === c) ctrl.current = null;
      }
    },
    [api],
  );
  const cancel = useCallback(() => ctrl.current?.abort(), []);
  return { progress, start, cancel };
}
