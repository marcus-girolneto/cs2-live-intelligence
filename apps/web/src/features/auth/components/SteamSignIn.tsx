"use client";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, SignInMark } from "@/shared/icons";
import { Callout, CrosshairLoader } from "@/shared/ui";
import { useSigninStatus } from "../hooks/useSigninStatus";
import { useSteamSignIn } from "../hooks/useSteamSignIn";
import { SIGNIN_MESSAGE } from "../model/signinParam";

export function SteamSignIn({
  size = "lg",
  showStatus = false,
}: {
  size?: "lg" | "md";
  /** Show the outcome of a failed Steam login (`?signin=`); one instance per page. */
  showStatus?: boolean;
}) {
  const { t } = useI18n();
  const { busy, error, start } = useSteamSignIn();
  const signin = useSigninStatus(showStatus);
  const status = signin.status;
  return (
    <div className="steam-signin">
      {status && (
        <Callout
          tone={status === "failed" ? "error" : "warn"}
          role="alert"
          className="signin-status"
        >
          <p>{t(SIGNIN_MESSAGE[status])}</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              signin.clear();
              void start();
            }}
          >
            {t("Try again")}
          </button>
        </Callout>
      )}
      <button
        type="button"
        className={`btn btn-steam ${size === "lg" ? "btn-lg" : ""}`}
        onClick={() => void start()}
        disabled={busy}
        aria-label={busy ? t("Opening Steam…") : t("Sign in with Steam")}
      >
        {busy ? <CrosshairLoader size={22} /> : <SignInMark size={22} />}
        <span>{busy ? t("Opening Steam…") : t("Sign in with Steam")}</span>
        {!busy && <ArrowRight size={18} className="btn-arrow" />}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
