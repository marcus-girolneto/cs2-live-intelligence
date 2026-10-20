import {
  ensureLocalSession,
  isApiError,
  platformHttp,
  webHttp,
  type HttpClient,
} from "@/shared/http";
import type { MeDto } from "@/shared/api-types";
import type { Account } from "@/shared/session";
import { UNKNOWN_SESSION, type SessionStatus } from "../model/session";

/** Session, identity and sign-in/out endpoints. */
export interface AuthApi {
  /** Never rejects: an unreachable probe answers "maybe signed in" (GET me decides). */
  getSession(): Promise<SessionStatus>;
  /** Opens the local demo session when the server allows it. */
  openLocalSession(): Promise<boolean>;
  getMe(): Promise<Account>;
  /** Steam OpenID start URL (validated by the caller before following it). */
  startSteamSignIn(): Promise<string>;
  /** Revokes the session upstream and clears the cookie. */
  logout(): Promise<void>;
  refreshProfile(): Promise<void>;
  /** Stores the interface language on the account (AI output and scheduled reports). */
  saveLanguage(lang: string): Promise<void>;
}

export function createAuthApi(
  http: HttpClient = platformHttp,
  web: HttpClient = webHttp,
  localSession: () => Promise<boolean> = ensureLocalSession,
): AuthApi {
  return {
    getSession: () =>
      web.get<SessionStatus>("session").catch((e: unknown) =>
        // An error status with a JSON body is still a session answer.
        isApiError(e) && e.body && Object.keys(e.body).length
          ? (e.body as SessionStatus)
          : UNKNOWN_SESSION,
      ),
    openLocalSession: localSession,
    getMe: () => http.get<MeDto>("me") as Promise<Account>,
    startSteamSignIn: () =>
      http.get<{ url: string }>("auth/steam/start").then((r) => r.url),
    logout: () => web.post<void>("logout", undefined, { timeoutMs: 12000 }),
    refreshProfile: () => http.post<void>("me/refresh-profile"),
    saveLanguage: (lang) => http.put<void>("me/language", { lang }),
  };
}

export const authApi = createAuthApi();
