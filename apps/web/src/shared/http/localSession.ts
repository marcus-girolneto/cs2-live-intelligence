/**
 * In local demo mode the server can open a session from its own credential. Only tried
 * when the server says automatic local sign-in is enabled, so a normal visitor never
 * triggers a failing request (and console error) before signing in.
 */
let localSession: Promise<boolean> | undefined;

export function ensureLocalSession(): Promise<boolean> {
  localSession ??= fetch("/api/config", { cache: "no-store" })
    .then((r) =>
      r.ok
        ? (r.json() as Promise<{ devLogin?: boolean }>)
        : ({} as { devLogin?: boolean }),
    )
    .then((c) =>
      c.devLogin
        ? fetch("/api/demo-session", { method: "POST" }).then((r) => r.ok)
        : false,
    )
    .catch(() => false)
    .then((ok) => {
      if (!ok) localSession = undefined;
      return ok;
    });
  return localSession;
}
