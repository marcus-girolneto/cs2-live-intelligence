import { devAuthAllowed } from "../config";
import { apiUrl, COOKIE, json, sameOrigin, validSession } from "../session";
export async function POST(request: Request) {
  if (!devAuthAllowed())
    return json(
      { error: "Development login is disabled. Sign in with Steam." },
      403,
    );
  if (!sameOrigin(request)) return json({ error: "Origin not allowed" }, 403);
  try {
    const body = (await request.json()) as {
      token?: unknown;
      sessionId?: unknown;
    };
    if (
      typeof body.token !== "string" ||
      body.token.length < 1 ||
      body.token.length > 512 ||
      !validSession(body.sessionId)
    )
      return json({ error: "Enter an owner token and session ID." }, 400);
    const upstream = await fetch(
      `${apiUrl()}/v1/live/sessions/${encodeURIComponent(body.sessionId)}`,
      {
        headers: { Authorization: `Bearer ${body.token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!upstream.ok && upstream.status !== 404)
      return json(
        { error: "Owner token was rejected." },
        upstream.status === 401 || upstream.status === 403 ? 401 : 502,
      );
    const response = json({ ok: true });
    response.cookies.set(COOKIE, body.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch {
    return json({ error: "Cannot reach the live service." }, 502);
  }
}
