import { apiUrl, json, ownerToken, sameOrigin, validSession } from "../session";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origin not allowed" }, 403);
  const token = await ownerToken();
  if (!token) return json({ error: "Sign in to connect." }, 401);
  try {
    const body = (await request.json()) as { sessionId?: unknown };
    if (!validSession(body.sessionId))
      return json({ error: "Session ID is required." }, 400);
    const response = await fetch(`${apiUrl()}/v1/live/tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: body.sessionId }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      return json(
        {
          error:
            response.status === 401
              ? "Sign in again to connect."
              : "Session is unavailable.",
        },
        response.status,
      );
    const result = (await response.json()) as { ticket: string };
    return json({ ticket: result.ticket });
  } catch {
    return json({ error: "Cannot reach the live service." }, 502);
  }
}
