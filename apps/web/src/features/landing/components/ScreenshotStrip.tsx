"use client";
import { useI18n } from "@/shared/i18n";

const SHOTS = [
  { src: "/landing/dashboard.webp", label: "Dashboard" },
  { src: "/landing/coach-report.webp", label: "AI Coach report" },
  { src: "/landing/aim.webp", label: "Aim analysis" },
  { src: "/landing/live-hud.webp", label: "Second-screen HUD" },
] as const;

/** Real screenshots of the product (lazy, fixed size: no layout shift), tilt on hover. */
export function ScreenshotStrip() {
  const { t } = useI18n();
  return (
    <section className="landing-section shots" aria-labelledby="shots-title">
      <div className="ls-head">
        <span className="eyebrow">{t("Inside the app")}</span>
        <h2 id="shots-title">{t("What you get after every match")}</h2>
      </div>
      <ul className="shot-strip">
        {SHOTS.map((s) => (
          <li key={s.src}>
            <figure className="shot">
              {/* Plain img: static webp from /public, sized to avoid layout shift. */}
              <img
                src={s.src}
                alt={t(s.label)}
                width={1200}
                height={750}
                loading="lazy"
                decoding="async"
              />
              <figcaption>{t(s.label)}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
