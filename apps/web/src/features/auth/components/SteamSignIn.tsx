"use client";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, SignInMark } from "@/shared/icons";
import { CrosshairLoader } from "@/shared/ui";
import { useSteamSignIn } from "../hooks/useSteamSignIn";

export function SteamSignIn({ size = "lg" }: { size?: "lg" | "md" }) {
  const { t } = useI18n();
  const { busy, error, start } = useSteamSignIn();
  return (
    <div className="steam-signin">
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
