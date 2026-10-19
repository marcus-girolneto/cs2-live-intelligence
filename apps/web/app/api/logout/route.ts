import { COOKIE, json, sameOrigin } from "../../../lib/server";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origin not allowed" }, 403);
  const response = json({ ok: true });
  response.cookies.delete(COOKIE);
  return response;
}
