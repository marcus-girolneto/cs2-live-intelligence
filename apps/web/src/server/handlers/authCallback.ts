import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiUrl, COOKIE } from "../session";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.WEB_ORIGIN ?? url.origin;
  const code = url.searchParams.get("code");
  if (!code || code.length > 256)
    return NextResponse.redirect(
      new URL("/settings?auth=failed#steam", origin),
    );
  try {
    const binding = (await cookies()).get("cs2_steam_exchange")?.value;
    if (!binding) throw new Error("Missing browser binding");
    const upstream = await fetch(`${apiUrl()}/v1/auth/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `cs2_steam_exchange=${binding}`,
      },
      body: JSON.stringify({ code }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) throw new Error("Exchange failed");
    const { token } = (await upstream.json()) as { token?: string };
    if (!token) throw new Error("No token");
    const response = NextResponse.redirect(
      new URL("/settings?auth=ok#steam", origin),
    );
    response.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(origin).protocol === "https:",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    response.cookies.delete("cs2_steam_exchange");
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/settings?auth=failed#steam", origin),
    );
  }
}
