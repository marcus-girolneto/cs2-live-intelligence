/**
 * Minimal OpenAI-compatible chat-completions server for end-to-end tests. It answers with a
 * structurally valid review that cites the first supplied fact, so the real API path (config,
 * HTTP call, parsing, citation validation) is exercised without a paid provider.
 */
import { createServer } from "node:http";

const port = Number(process.env.MOCK_AI_PORT ?? 3120);
const key = process.env.MOCK_AI_KEY ?? "e2e-ai-key";
/** Calls per kind: the claim verifier is a second call after each review when it is enabled. */
const counts = { review: 0, verify: 0, live: 0, other: 0 };
createServer((req, res) => {
  if (req.method === "GET" && req.url === "/calls") {
    res.writeHead(200, { "content-type": "application/json" });
    const calls = Object.values(counts).reduce((a, b) => a + b, 0);
    return res.end(JSON.stringify({ calls, ...counts }));
  }
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    res.writeHead(404);
    return res.end();
  }
  if (req.headers.authorization !== `Bearer ${key}`) {
    res.writeHead(401, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: { message: "invalid api key" } }));
  }
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const body = JSON.parse(raw) as {
      model: string;
      messages: { content: string }[];
    };
    let facts: { id: string; kind: string; value: number }[] | undefined;
    let claims: { id: string }[] | undefined;
    let live = false;
    try {
      // The data sits between per-request <<DATA-…>> / <<END-…>> markers.
      const text = body.messages[1]!.content;
      const user = JSON.parse(
        text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
      ) as {
        facts?: typeof facts;
        claims?: typeof claims;
        recentRounds?: unknown;
      };
      facts = user.facts;
      claims = user.claims;
      live = Array.isArray(user.recentRounds);
    } catch {
      facts = undefined;
    }
    const portuguese = body.messages[0]!.content.includes(
      "write every human-readable field (summary, observation, actionablePractice, caveats, plan, call, why) in Brazilian Portuguese",
    );
    const verify = Array.isArray(claims);
    counts[
      verify ? "verify" : live ? "live" : facts?.length ? "review" : "other"
    ]++;
    const content = verify
      ? {
          results: claims!.map((c) => ({
            id: c.id,
            supported: true,
            correctedText: "",
          })),
        }
      : live
        ? {
            call: "Mock IGL: play for the trade next round.",
            why: "Mock reasoning from your recent rounds.",
            focus: "trade",
            confidence: "medium",
          }
        : facts?.length
          ? {
              summary: portuguese
                ? "Revisão de teste do modelo simulado."
                : "Mock model review for end-to-end tests.",
              insights: facts.slice(0, 2).map((f, i) => ({
                observation: `${f.kind} = ${f.value}`,
                evidenceIds: [f.id],
                confidence: "medium",
                actionablePractice: "Practice drill from the mock model.",
                caveats: [],
                kind: i === 0 ? "improve" : "strength",
              })),
              plan: ["Mock plan: trade your entry"],
            }
          : { ok: true, reply: "Mock provider is working." };
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
        usage: { prompt_tokens: 120, completion_tokens: 60 },
      }),
    );
  });
}).listen(port, "127.0.0.1", () => console.log(`mock AI provider on ${port}`));
