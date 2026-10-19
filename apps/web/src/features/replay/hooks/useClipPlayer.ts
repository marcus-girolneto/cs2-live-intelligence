"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { drawScene, type RenderCache, type SceneOptions } from "../model/draw";
import {
  effectiveSpeed,
  type ReplayMeta,
  type ReplayWindow,
} from "../model/replay";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ])
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  return null;
}
/** MediaRecorder + canvas.captureStream with a WebM codec. */
export function canExportVideo() {
  return (
    typeof window !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    pickMime() !== null
  );
}

type Options = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  meta: ReplayMeta;
  win: ReplayWindow;
  at?: number;
  focus: number | null;
  scene: Omit<SceneOptions, "focus" | "at" | "reducedMotion" | "clock">;
  /**
   * Called when playback reaches the end; return true when the caller moves on to another
   * window (match reel): playback and any recording continue on the next window.
   */
  onEnd?: () => boolean;
  /** Loop the window by default (single clips); a reel plays through instead. */
  initialLoop?: boolean;
};

/**
 * Playback engine: owns the requestAnimationFrame loop, the clock (speed, slow-mo, loop),
 * devicePixelRatio-aware canvas sizing and WebM export. React state is only updated ~12×/s.
 */
export function useClipPlayer({
  canvasRef,
  boxRef,
  meta,
  win,
  at,
  focus,
  scene,
  onEnd,
  initialLoop = true,
}: Options) {
  const start = win.frames[0]!.t;
  const end = Math.max(start + 0.1, win.frames.at(-1)!.t);
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(initialLoop);
  const [slowmo, setSlowmo] = useState(true);
  const [recording, setRecording] = useState(false);
  const [download, setDownload] = useState<string | null>(null);
  const live = useRef({ t: start, playing, speed, loop, slowmo });
  live.current.playing = playing;
  live.current.speed = speed;
  live.current.loop = loop;
  live.current.slowmo = slowmo;
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const cache = useRef<RenderCache>({ key: "", canvas: null });
  const recorder = useRef<{ rec: MediaRecorder; stream: MediaStream } | null>(
    null,
  );
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const advancing = useRef(false);
  // A new window (next clip of a reel) starts from its beginning.
  useEffect(() => {
    advancing.current = false;
    live.current.t = start;
    setT(start);
  }, [win, start]);

  // Autoplay unless the user prefers reduced motion.
  useEffect(() => setPlaying(!reducedMotion()), []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const w = Math.max(240, box.clientWidth);
    const bw = meta.bounds.maxX - meta.bounds.minX;
    const bh = meta.bounds.maxY - meta.bounds.minY;
    const aspect = Math.min(1, Math.max(0.56, bh / Math.max(1, bw)));
    const h = Math.round(
      Math.min(w * aspect, Math.max(260, window.innerHeight * 0.62)),
    );
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    size.current = { w, h, dpr };
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }, [canvasRef, boxRef, meta.bounds]);

  useEffect(() => {
    resize();
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    return () => ro.disconnect();
  }, [resize, boxRef]);

  const stopRecording = useCallback(() => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    if (r.rec.state !== "inactive") r.rec.stop();
    r.stream.getTracks().forEach((x) => x.stop());
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const motion = !reducedMotion();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = live.current;
      if (s.playing) {
        s.t += dt * effectiveSpeed(s.speed, s.t, at, s.slowmo);
        if (s.t >= end) {
          if (advancing.current) s.t = end;
          else if (onEndRef.current?.()) {
            advancing.current = true;
            s.t = end;
          } else if (recorder.current) {
            s.t = end;
            stopRecording();
            setPlaying(false);
          } else if (s.loop) s.t = start;
          else {
            s.t = end;
            setPlaying(false);
          }
        }
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const { w, h, dpr } = size.current;
      if (ctx && w > 0)
        drawScene(
          ctx,
          w,
          h,
          dpr,
          meta,
          win,
          s.t,
          {
            ...sceneRef.current,
            focus,
            ...(at !== undefined ? { at } : {}),
            reducedMotion: !motion,
            clock: now / 1000,
          },
          cache.current,
        );
      if (now - lastUi > 80) {
        lastUi = now;
        setT(s.t);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [meta, win, at, focus, start, end, canvasRef, stopRecording]);

  useEffect(
    () => () => {
      stopRecording();
    },
    [stopRecording],
  );
  useEffect(
    () => () => {
      if (download) URL.revokeObjectURL(download);
    },
    [download],
  );

  const seek = useCallback(
    (next: number) => {
      live.current.t = Math.max(start, Math.min(end, next));
      setT(live.current.t);
    },
    [start, end],
  );
  const toggle = useCallback(() => {
    if (!live.current.playing && live.current.t >= end - 0.01)
      live.current.t = start;
    setPlaying((p) => !p);
  }, [start, end]);

  const exportClip = useCallback(() => {
    const canvas = canvasRef.current;
    const mime = pickMime();
    if (!canvas || !mime || recorder.current) return;
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 4_000_000,
    });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      setRecording(false);
      if (chunks.length)
        setDownload(
          URL.createObjectURL(new Blob(chunks, { type: "video/webm" })),
        );
    };
    recorder.current = { rec, stream };
    setDownload(null);
    setRecording(true);
    live.current.t = start;
    setPlaying(true);
    rec.start(250);
  }, [canvasRef, start]);

  return {
    t,
    start,
    end,
    playing,
    toggle,
    seek,
    speed,
    setSpeed,
    loop,
    setLoop,
    slowmo,
    setSlowmo,
    recording,
    exportClip,
    cancelExport: stopRecording,
    download,
  };
}
