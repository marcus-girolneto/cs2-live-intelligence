import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { unwrapData } from "@cs2/coaching";

/**
 * A minimal OpenAI-compatible chat endpoint for integration tests: answers the claim verifier
 * with "no changes" and any review request with a one-insight review citing the first fact.
 */
export async function startMockAi(): Promise<{
  server: Server;
  baseUrl: string;
  hits: () => number;
}> {
  let hits = 0;
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw) as {
        model: string;
        messages: { content: string }[];
      };
      let content: unknown = { results: [] };
      if (!raw.includes("fact checker of this app")) {
        hits++;
        let user: { facts?: { id: string }[] } = {};
        try {
          user = unwrapData(body.messages[1]!.content) as typeof user;
        } catch {
          /* connectivity checks send plain text */
        }
        content = user.facts
          ? {
              summary: "Mock review.",
              insights: [
                {
                  observation: "Opening duels decided your rounds.",
                  evidenceIds: [user.facts[0]!.id],
                  confidence: "medium",
                  actionablePractice: "Play opening fights with a teammate.",
                  caveats: [],
                  kind: "improve",
                },
              ],
              plan: ["Trade your entry fragger"],
            }
          : { ok: true, reply: "Working." };
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          model: body.model,
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(content) },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return {
    server,
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    hits: () => hits,
  };
}

/** Collects webhook deliveries (raw body + headers) on a local port. */
export async function startWebhookReceiver(): Promise<{
  server: Server;
  url: string;
  received: { headers: Record<string, string>; body: string }[];
}> {
  const received: { headers: Record<string, string>; body: string }[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      received.push({
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, String(v)]),
        ),
        body: raw,
      });
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return {
    server,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`,
    received,
  };
}
