import { simulatorConfig } from "../config";
import { json, ownerToken, sameOrigin } from "../session";
async function call(method: "GET" | "POST", path: string) {
  const config = simulatorConfig();
  if (!config) return json({ error: "Match simulator is not available." }, 404);
  try {
    const upstream = await fetch(`${config.url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok)
      return json({ error: "Match simulator rejected the request." }, 502);
    const body = (await upstream.json()) as {
      running: boolean;
      round: number;
      rounds: number;
    };
    return json({
      running: body.running === true,
      round: Number.isFinite(body.round) ? body.round : 0,
      rounds: Number.isFinite(body.rounds) ? body.rounds : 0,
    });
  } catch {
    return json({ error: "Match simulator is not running." }, 502);
  }
}
export async function GET() {
  if (!simulatorConfig()) return json({ available: false });
  const response = await call("GET", "/status");
  if (!response.ok) return json({ available: false });
  return json({ available: true, ...(await response.json()) });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origin not allowed" }, 403);
  if (!(await ownerToken()))
    return json({ error: "Sign in to continue." }, 401);
  const { action } = (await request.json().catch(() => ({}))) as {
    action?: unknown;
  };
  if (action !== "start" && action !== "stop")
    return json({ error: "Unknown action." }, 400);
  return call("POST", `/${action}`);
}
