"use client";
import { useI18n } from "../i18n";
import { useElapsed } from "../hooks/useElapsed";

/** Dynamic CS crosshair: the four arms "bloom" outward like spray recoil and recover. */
export function CrosshairLoader({
  size = 40,
  label,
}: {
  size?: number;
  label?: string;
}) {
  return (
    <span
      className="xhair-loader"
      role={label ? "status" : undefined}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
        <g className="xh-arms">
          <rect className="xh-n" x="18.5" y="4" width="3" height="10" rx="1" />
          <rect className="xh-s" x="18.5" y="26" width="3" height="10" rx="1" />
          <rect className="xh-w" x="4" y="18.5" width="10" height="3" rx="1" />
          <rect className="xh-e" x="26" y="18.5" width="10" height="3" rx="1" />
        </g>
        <circle className="xh-dot" cx="20" cy="20" r="1.6" />
        <circle className="xh-ring" cx="20" cy="20" r="17" />
      </svg>
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}

/** Centered loading block for whole pages / panels. */
export function PageLoader({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="page-loader" role="status" aria-busy="true">
      <CrosshairLoader size={56} />
      <span className="loader-label">{label ?? t("Loading…")}</span>
    </div>
  );
}

/**
 * C4 defuse loader for long AI calls: the bomb's LED blinks faster as time goes on and a
 * defuse bar fills over a 10 s cycle (5 s "with kit" feel), with real elapsed seconds.
 */
export function DefuseLoader({
  since,
  title,
  steps,
}: {
  since: number;
  title: string;
  steps?: string[];
}) {
  const { t, locale } = useI18n();
  const elapsed = useElapsed(since);
  const cycle = 10;
  const progress = ((elapsed % cycle) / cycle) * 100;
  const step = steps?.length
    ? steps[Math.min(steps.length - 1, Math.floor(elapsed / 6))]
    : undefined;
  const fast = elapsed > 20;
  return (
    <div className="defuse" role="status" aria-live="polite" aria-busy="true">
      <div className={`c4 ${fast ? "fast" : ""}`} aria-hidden>
        <svg viewBox="0 0 120 72" width="120" height="72">
          <rect
            x="6"
            y="18"
            width="108"
            height="48"
            rx="4"
            className="c4-body"
          />
          <rect
            x="16"
            y="26"
            width="46"
            height="16"
            rx="2"
            className="c4-screen"
          />
          <text x="39" y="38.5" textAnchor="middle" className="c4-digits">
            {String(Math.floor(elapsed)).padStart(3, "0")}
          </text>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <rect
                key={`${r}${c}`}
                x={72 + c * 12}
                y={26 + r * 11}
                width="9"
                height="8"
                rx="1.5"
                className="c4-key"
              />
            )),
          )}
          <rect
            x="16"
            y="48"
            width="46"
            height="10"
            rx="2"
            className="c4-pack"
          />
          <path d="M30 18 C30 6 52 6 52 18" className="c4-wire" />
          <path d="M44 18 C46 2 74 4 70 18" className="c4-wire alt" />
          <circle cx="104" cy="12" r="5" className="c4-led" />
        </svg>
      </div>
      <div className="defuse-text">
        <strong>{title}</strong>
        <div className="defuse-bar">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="defuse-meta">
          <span>{step ?? t("Defusing…")}</span>
          <span className="defuse-time">
            {t("{s}s", {
              s: elapsed.toLocaleString(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Radar sweep, used while a demo is being parsed. */
export function RadarLoader({ label }: { label: string }) {
  return (
    <div className="radar-loader" role="status" aria-busy="true">
      <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden>
        <circle cx="40" cy="40" r="36" className="rl-ring" />
        <circle cx="40" cy="40" r="24" className="rl-ring" />
        <circle cx="40" cy="40" r="12" className="rl-ring" />
        <path d="M40 4v72M4 40h72" className="rl-ring" />
        <g className="rl-sweep">
          <path d="M40 40 L40 4 A36 36 0 0 1 71 22 Z" />
        </g>
        <circle cx="55" cy="26" r="2.5" className="rl-blip" />
        <circle cx="26" cy="52" r="2.5" className="rl-blip b2" />
      </svg>
      <span className="loader-label">{label}</span>
    </div>
  );
}
