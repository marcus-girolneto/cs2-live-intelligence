import { localDemoToken } from "../config";
import { COOKIE, json, sameOrigin } from "../session";
// Local-only: sets the configured owner credential as an HttpOnly cookie so the
// demo works without copying tokens. The token itself never reaches the client.
export async function POST(request: Request) {
  const token = localDemoToken();
  if (!token)
    return json({ error: "Acesso local de demonstração desativado." }, 403);
  if (!sameOrigin(request)) return json({ error: "Origin not allowed" }, 403);
  const response = json({ ok: true });
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
