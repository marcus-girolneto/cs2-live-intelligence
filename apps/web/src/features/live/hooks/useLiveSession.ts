"use client";
import { useEffect, useState } from "react";
import type { LiveState } from "@cs2/contracts";
import { ensureLocalSession } from "@/shared/http";
import { useLiveApi } from "../api/context";
import { applyMessage, retryDelay, type Connection } from "../model/live";
import type { LiveTarget } from "../model/types";

/** Ticketed, auto-reconnecting WebSocket subscription to one live session. */
export function useLiveSession(target: LiveTarget | null) {
  const api = useLiveApi();
  const [state, setState] = useState<LiveState | null>(null);
  const [connection, setConnection] = useState<Connection>("disconnected");
  const [error, setError] = useState("");
  useEffect(() => {
    setState(null);
    if (!target) {
      setConnection("disconnected");
      return;
    }
    const sessionId = target.id;
    let cancelled = false;
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const controller = new AbortController();
    function retry() {
      if (cancelled) return;
      setConnection("disconnected");
      timer = setTimeout(() => void connect(), retryDelay(attempt++));
    }
    async function connect() {
      if (cancelled) return;
      setConnection("connecting");
      try {
        await ensureLocalSession();
        const result = await api.requestTicket(sessionId, controller.signal);
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error ?? "Could not connect.");
          if ([401, 403, 404].includes(result.status)) {
            setConnection("disconnected");
            return;
          }
          retry();
          return;
        }
        socket = api.openSocket(sessionId, result.ticket);
        socket.onopen = () => {
          if (!cancelled) {
            attempt = 0;
            setError("");
            setConnection("connected");
          }
        };
        socket.onmessage = (event: MessageEvent<string>) => {
          if (cancelled) return;
          try {
            const data: unknown = JSON.parse(event.data);
            setState((previous) => applyMessage(previous, data, sessionId));
          } catch {
            /* Ignore malformed frames; keep the last valid projection. */
          }
        };
        socket.onclose = retry;
        socket.onerror = () => socket?.close();
      } catch {
        if (!cancelled) {
          setError("Live service unavailable. Retrying…");
          retry();
        }
      }
    }
    void connect();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
      socket?.close();
    };
  }, [api, target]);
  return { state, connection, error };
}
