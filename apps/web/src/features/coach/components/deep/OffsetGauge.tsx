"use client";
import { useI18n } from "@/shared/i18n";
import { formatNumber } from "@/shared/format";

const MAX = 12;
/** Semicircle gauge of the median pre-aim offset in degrees (lower is better). */
export function OffsetGauge({ value }: { value: number }) {
  const { t, locale } = useI18n();
  const v = Math.min(MAX, Math.max(0, value));
  const angle = Math.PI * (1 - v / MAX);
  const r = 80;
  const cx = 100;
  const cy = 96;
  const nx = cx + r * Math.cos(angle);
  const ny = cy - r * Math.sin(angle);
  const tone = value <= 3 ? "good" : value <= 6 ? "warn" : "bad";
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / MAX);
    const a1 = Math.PI * (1 - to / MAX);
    return `M ${cx + r * Math.cos(a0)} ${cy - r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)}`;
  };
  const label = formatNumber(value, 1, locale) ?? "—";
  return (
    <figure className={`offset-gauge ${tone}`}>
      <svg
        viewBox="0 0 200 112"
        role="img"
        aria-label={t("Median pre-aim offset {n}°", { n: label })}
      >
        <path d={arc(0, 3)} className="og-band good" />
        <path d={arc(3, 6)} className="og-band warn" />
        <path d={arc(6, MAX)} className="og-band bad" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} className="og-needle" />
        <circle cx={cx} cy={cy} r="5" className="og-hub" />
        <text x="18" y="110" className="og-tick">
          0°
        </text>
        <text x="170" y="110" className="og-tick">
          {MAX}°+
        </text>
      </svg>
      <figcaption>
        <b className="tabular">{label}°</b>
        <small>{t("median pre-aim offset")}</small>
      </figcaption>
    </figure>
  );
}
