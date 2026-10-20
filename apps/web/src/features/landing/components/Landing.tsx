"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SteamSignIn } from "@/features/auth";
import { PricingSection } from "@/features/billing";
import { Brand, LangToggle } from "@/features/shell";
import { BRAND, LogoMark, Wordmark } from "@/shared/brand";
import { useI18n } from "@/shared/i18n";
import { Crosshair, Lock, ShieldCheck, Check, Eye } from "@/shared/icons";
import { FAQ, STEPS } from "../model/content";
import { FrustrationBoard } from "./FrustrationBoard";
import { ModeShowcase } from "./ModeShowcase";
import { ScreenshotStrip } from "./ScreenshotStrip";
import { TryIt } from "./TryIt";
import { TwoModes } from "./TwoModes";
export function Landing() {
  const { t, lang } = useI18n();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(
      new URLSearchParams(window.location.search).get("auth") === "failed",
    );
  }, []);
  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden />
      <header className="landing-top">
        <Brand />
        <LangToggle />
      </header>

      <main>
        <section className="landing-main">
          <div className="landing-hero">
            <div className="hero-logo">
              <LogoMark size={112} animated title={BRAND.name} />
              <div>
                <Wordmark className="hero-wordmark" />
                <span className="hero-tagline">{BRAND.tagline[lang]}</span>
              </div>
            </div>
            <span className="eyebrow">
              <Crosshair size={16} /> {t("AI coach for Counter-Strike 2")}
            </span>
            <h1>
              {t("Tired of losing")}
              <span>{t("and not knowing why?")}</span>
            </h1>
            <p className="lead">
              {t(
                "Our AI coach reads your demos and shows you what is costing you rounds: where you die, where your bullets go, when you peek. Then it tells you what to fix next match.",
              )}
            </p>
            {failed && (
              <p role="alert" className="form-error">
                {t("Steam sign-in could not be completed. Please try again.")}
              </p>
            )}
            <SteamSignIn showStatus />
            <p className="landing-note">
              <Lock size={16} />
              {t(
                "We only receive your public SteamID from Steam. We never see your password.",
              )}
            </p>
            <ul className="trust-row">
              <li>
                <Check size={14} /> {t("Free")}
              </li>
              <li>
                <Check size={14} /> {t("No password shared")}
              </li>
              <li>
                <Check size={14} /> {t("Fair play by design")}
              </li>
            </ul>
          </div>
          <ModeShowcase />
        </section>

        <TwoModes />
        <FrustrationBoard />
        <TryIt />
        <ScreenshotStrip />

        <section className="landing-section" aria-labelledby="how-title">
          <div className="ls-head">
            <span className="eyebrow">{t("How it works")}</span>
            <h2 id="how-title">{t("From demo to plan in three steps")}</h2>
          </div>
          <ol className="how">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <span className="how-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="how-icon">
                  <Icon size={26} />
                </span>
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="landing-section trust"
          aria-labelledby="trust-title"
        >
          <div className="ls-head">
            <span className="eyebrow">{t("Fair play & privacy")}</span>
            <h2 id="trust-title">
              {t("Built to make you better, not to cheat")}
            </h2>
          </div>
          <div className="trust-grid">
            <div>
              <ShieldCheck size={24} />
              <strong>{t("No game injection")}</strong>
              <span>
                {t("Reads demos and the official game state integration only.")}
              </span>
            </div>
            <div>
              <Eye size={24} />
              <strong>{t("Only what you could see")}</strong>
              <span>
                {t("Live calls use your own player data, between rounds.")}
              </span>
            </div>
            <div>
              <Lock size={24} />
              <strong>{t("Your data, your call")}</strong>
              <span>
                {t("Consent, retention and full account deletion in Settings.")}
              </span>
            </div>
          </div>
        </section>

        <div className="landing-section">
          <PricingSection
            signedIn={false}
            plan={null}
            showFaq={false}
            signIn={<SteamSignIn size="md" />}
          />
        </div>

        <section className="landing-section" aria-labelledby="faq-title">
          <div className="ls-head">
            <span className="eyebrow">FAQ</span>
            <h2 id="faq-title">{t("Questions")}</h2>
          </div>
          <div className="faq">
            {FAQ.map(({ q, a }) => (
              <details key={q}>
                <summary>{t(q)}</summary>
                <p>{t(a)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <h2>{t("Your next match starts here.")}</h2>
          <p className="lead">
            {t(
              "Sign in, drop a demo, and find out what is really costing you rounds.",
            )}
          </p>
          <SteamSignIn />
        </section>
      </main>

      <footer className="landing-foot">
        <span>
          <ShieldCheck size={16} />{" "}
          {t(
            "Independent project, not affiliated with Valve. Counter-Strike 2 and its artwork are trademarks of Valve Corporation.",
          )}
        </span>
        <span className="footer-links">
          <Link href="/pricing">{t("Pricing")}</Link>
          <Link href="/privacy">{t("Privacy")}</Link>
        </span>
      </footer>
    </div>
  );
}

/** Preview of the analysis built from a real public sample match (Mirage). */
