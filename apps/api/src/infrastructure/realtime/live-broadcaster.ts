import type { WebSocket } from "ws";
import type { ServerMessage } from "@cs2/contracts";

interface Subscriber {
  ownerId: string;
  sessionId: string;
  alive: boolean;
}

/** Port: pushes live-session messages to subscribed browsers. */
export interface LiveBroadcaster {
  readonly connections: number;
  subscribe(socket: WebSocket, ownerId: string, sessionId: string): void;
  send(socket: WebSocket, message: ServerMessage): void;
  publish(ownerId: string, sessionId: string, message: ServerMessage): void;
  disconnectOwner(ownerId: string): void;
  close(): void;
}

/** Sockets slower than this many buffered bytes are dropped instead of buffering more. */
const MAX_BUFFERED = 1024 * 1024;

/**
 * WebSocket adapter with liveness: each heartbeat pings every socket and terminates the ones
 * that did not answer the previous ping.
 */
export class WebSocketBroadcaster implements LiveBroadcaster {
  private readonly clients = new Map<WebSocket, Subscriber>();
  private readonly timer: NodeJS.Timeout;
  constructor(
    heartbeatMs: number,
    private readonly now: () => number,
    /** Runs before every heartbeat (expires in-memory sessions, tickets and rate windows). */
    private readonly beforeHeartbeat: () => void = () => undefined,
  ) {
    this.timer = setInterval(() => this.heartbeat(), heartbeatMs);
    this.timer.unref();
  }

  get connections(): number {
    return this.clients.size;
  }

  subscribe(socket: WebSocket, ownerId: string, sessionId: string): void {
    this.clients.set(socket, { ownerId, sessionId, alive: true });
    socket.on("pong", () => {
      const client = this.clients.get(socket);
      if (client) client.alive = true;
    });
    socket.on("close", () => this.clients.delete(socket));
    socket.on("error", () => this.clients.delete(socket));
  }

  send(socket: WebSocket, message: ServerMessage): void {
    if (socket.bufferedAmount > MAX_BUFFERED) {
      socket.terminate();
      this.clients.delete(socket);
      return;
    }
    if (socket.readyState === 1) socket.send(JSON.stringify(message));
  }

  publish(ownerId: string, sessionId: string, message: ServerMessage): void {
    for (const [socket, client] of this.clients)
      if (client.ownerId === ownerId && client.sessionId === sessionId)
        this.send(socket, message);
  }

  disconnectOwner(ownerId: string): void {
    for (const [socket, client] of this.clients)
      if (client.ownerId === ownerId) {
        socket.terminate();
        this.clients.delete(socket);
      }
  }

  private heartbeat(): void {
    this.beforeHeartbeat();
    for (const [socket, client] of this.clients) {
      if (!client.alive) {
        socket.terminate();
        this.clients.delete(socket);
        continue;
      }
      client.alive = false;
      socket.ping();
      this.send(socket, {
        type: "heartbeat",
        at: new Date(this.now()).toISOString(),
      });
    }
  }

  close(): void {
    clearInterval(this.timer);
    for (const socket of this.clients.keys()) socket.terminate();
    this.clients.clear();
  }
}
