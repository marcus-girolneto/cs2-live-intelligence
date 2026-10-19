/** Check the browser origin against the public web origin, even behind Next's local listener. */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestUrl = new URL(request.url);
    const expected = process.env.WEB_ORIGIN
      ? new URL(process.env.WEB_ORIGIN).origin
      : new URL(
          `${requestUrl.protocol}//${request.headers.get("host") ?? requestUrl.host}`,
        ).origin;
    return origin === expected;
  } catch {
    return false;
  }
}
