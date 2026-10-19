"use client";
import Link from "next/link";
import { SampleImport } from "@/features/matches";
import { useI18n } from "@/shared/i18n";
import { ArrowRight, Check, Brain, Crosshair, Upload } from "@/shared/icons";
/** First-time onboarding: load the sample match or upload a demo. */
export function Onboarding() {
  const { t } = useI18n();
  return (
    <section className="onboard">
      <div className="onboard-text">
        <span className="eyebrow">
          <Crosshair size={16} /> {t("Get started")}
        </span>
        <h2>{t("Let's analyze your first match")}</h2>
        <p className="lead">
          {t(
            "Load a real public match to see everything the coach can do — hit groups, positions, timing and an AI review — in under a minute.",
          )}
        </p>
        <SampleImport
          big
          fallback={
            <Link className="btn btn-primary btn-lg" href="/upload">
              <Upload size={20} /> {t("Upload your first demo")}
            </Link>
          }
        />
        <Link className="btn-link" href="/upload">
          {t("Prefer your own match? Upload a .dem file")}{" "}
          <ArrowRight size={14} />
        </Link>
      </div>
      <ol className="onboard-steps">
        <li className="done">
          <Check size={16} /> {t("Signed in")}
        </li>
        <li className="now">
          <Crosshair size={16} /> {t("Analyze a match")}
        </li>
        <li>
          <Brain size={16} /> {t("Get your AI review and plan")}
        </li>
      </ol>
    </section>
  );
}
