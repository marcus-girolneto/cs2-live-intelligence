import { apiUrl, COOKIE, json, ownerToken, sameOrigin } from "../session";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origin not allowed" }, 403);
  const token = await ownerToken();
  if (token) {
    try {
      const upstream = await fetch(`${apiUrl()}/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok && upstream.status !== 401)
        return json(
          { error: "Could not revoke your session. Please retry signing out." },
          502,
        );
    } catch {
      return json(
        {
          error:
            "Could not reach the service to revoke your session. Please retry.",
        },
        502,
      );
    }
  }
  const response = json({ ok: true });
  response.cookies.delete(COOKIE);
  return response;
}
