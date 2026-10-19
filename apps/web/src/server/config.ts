export function devAuthAllowed(
  env: Record<string, string | undefined> = process.env,
) {
  return env.ENABLE_DEV_AUTH === "true" && env.APP_ENV === "local";
}
// Server-only: automatic sign-in as the local development owner. Off unless explicitly
// enabled with DEV_AUTO_LOGIN=true (automated tests); real use requires Steam sign-in.
export function localDemoToken(
  env: Record<string, string | undefined> = process.env,
) {
  const token = env.WEB_TOKEN;
  return devAuthAllowed(env) &&
    env.DEV_AUTO_LOGIN === "true" &&
    token &&
    token.length <= 512
    ? token
    : undefined;
}
// Server-only: local match simulator control, never exposed to the browser.
export function simulatorConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const url = env.SIMULATOR_URL;
  const token = env.GSI_AUTH_TOKEN;
  return devAuthAllowed(env) && url && token ? { url, token } : undefined;
}
