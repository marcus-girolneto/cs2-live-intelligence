"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { LiveState } from "@cs2/contracts";
import {
  applyMessage,
  display,
  freshness,
  retryDelay,
  type Connection,
} from "../lib/live";

export default function LiveDashboard() {
  const [sessionId, setSessionId] = useState("dev-session");
  const [token, setToken] = useState("");
  const [target, setTarget] = useState<{ id: string; key: number } | null>(
    null,
  );
  const [state, setState] = useState<LiveState | null>(null);
  const [connection, setConnection] = useState<Connection>("disconnected");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const controller = new AbortController();
    function retry() {
      if (cancelled) return;
      setConnection("disconnected");
      timer = setTimeout(() => {
        void connect();
      }, retryDelay(attempt++));
    }
    async function connect() {
      if (cancelled) return;
      setConnection("connecting");
      try {
        const response = await fetch("/api/ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: target!.id }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(7000),
          ]),
        });
        const result = (await response.json()) as {
          ticket?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || !result.ticket) {
          setError(result.error ?? "Could not connect.");
          if (
            response.status === 401 ||
            response.status === 403 ||
            response.status === 404
          ) {
            setConnection("disconnected");
            return;
          }
          retry();
          return;
        }
        const url = new URL(
          process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:4000",
        );
        url.pathname = "/v1/live";
        url.searchParams.set("sessionId", target!.id);
        url.searchParams.set("ticket", result.ticket);
        socket = new WebSocket(url);
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
            setState((previous) => applyMessage(previous, data, target!.id));
          } catch {
            /* Ignore malformed frames; keep the last valid projection. */
          }
        };
        socket.onclose = retry;
        socket.onerror = () => socket?.close();
      } catch {
        if (!cancelled) {
          setError("Live service unavailable. Reconnecting…");
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
  }, [target]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, sessionId: sessionId.trim() }),
        signal: AbortSignal.timeout(7000),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Could not sign in.");
        return;
      }
      setToken("");
      setState(null);
      setTarget({ id: sessionId.trim(), key: Date.now() });
    } catch {
      setError("Cannot reach the live service.");
    } finally {
      setBusy(false);
    }
  }
  function disconnect() {
    setTarget(null);
    setConnection("disconnected");
    void fetch("/api/logout", { method: "POST" });
  }
  const { age, stale } = freshness(state, now, connection);
  const status =
    connection === "disconnected"
      ? state
        ? "Disconnected · stale"
        : "Disconnected"
      : connection === "connecting"
        ? state
          ? "Reconnecting · stale"
          : "Connecting"
        : stale
          ? "Stale"
          : state
            ? "Live"
            : "Waiting for telemetry";
  return (
    <main>
      <header className="header">
        <a className="brand" href="/" aria-label="CS2 Live Intelligence home">
          <span className="brand-mark">C2</span>
          <span>
            CS2 <strong>LIVE INTELLIGENCE</strong>
          </span>
        </a>
        <span className="scope">OWN PLAYER / GSI</span>
      </header>
      <div className="intro">
        <p className="eyebrow">MATCH TELEMETRY</p>
        <h1>Your match, live.</h1>
        <p className="muted">
          A second screen for the information your game shares.
        </p>
      </div>
      <section className="connect panel" aria-labelledby="connect-title">
        <div>
          <h2 id="connect-title">Connect a session</h2>
          <p className="muted">
            Use your provisioned owner token and collector session ID.
          </p>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Owner token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
              maxLength={512}
            />
          </label>
          <label>
            Session ID
            <input
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              required
              maxLength={128}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Connecting…" : "Connect"}
          </button>
          {target && (
            <button className="secondary" type="button" onClick={disconnect}>
              Disconnect
            </button>
          )}
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      <div className="statusbar">
        <span
          role="status"
          data-testid="connection-status"
          className={`status ${stale || connection === "disconnected" ? "warning" : connection === "connected" && state ? "live" : ""}`}
        >
          <i aria-hidden="true" />
          {status}
        </span>
        <span data-testid="last-updated">
          Last update:{" "}
          {age === null ? "Not available" : `${(age / 1000).toFixed(1)}s ago`}
        </span>
        <span>
          Source:{" "}
          <strong data-testid="source">
            {state ? "GSI" : "Not available"}
          </strong>
        </span>
      </div>
      <section className="match panel" aria-labelledby="match-title">
        <div className="match-heading">
          <div>
            <p className="eyebrow">CURRENT MATCH</p>
            <h2 id="match-title" data-testid="map">
              {display(state?.map)}
            </h2>
          </div>
          <div className="phase">
            <span>Phase</span>
            <strong data-testid="phase">{display(state?.phase)}</strong>
          </div>
        </div>
        <div className="scoreboard">
          <div className="team ct">
            <span>COUNTER-TERRORISTS</span>
            <strong data-testid="score-ct">{display(state?.score?.ct)}</strong>
          </div>
          <div className="round">
            <span>ROUND</span>
            <strong data-testid="round">{display(state?.round)}</strong>
          </div>
          <div className="team t">
            <span>TERRORISTS</span>
            <strong data-testid="score-t">{display(state?.score?.t)}</strong>
          </div>
        </div>
      </section>
      <section className="own-section" aria-labelledby="own-title">
        <div className="section-heading">
          <h2 id="own-title">Your performance</h2>
          <span className="muted">Own player only</span>
        </div>
        <div className="stats">
          {(
            [
              ["Kills", "kills"],
              ["Deaths", "deaths"],
              ["Assists", "assists"],
              ["Health", "health"],
              ["Armor", "armor"],
            ] as const
          ).map(([label, key]) => (
            <div className="stat panel" key={key}>
              <h3>{label}</h3>
              <strong
                data-testid={key}
                className={
                  state?.ownStats?.[key] === undefined
                    ? "unavailable"
                    : undefined
                }
              >
                {display(state?.ownStats?.[key])}
              </strong>
            </div>
          ))}
        </div>
      </section>
      <footer>
        <p>
          Unavailable values are shown explicitly. Stats depend on what your
          game sends.
        </p>
        <p>
          {target
            ? `Session: ${target.id}`
            : "Connect to begin receiving telemetry."}{" "}
          · Own player visibility
        </p>
      </footer>
    </main>
  );
}
