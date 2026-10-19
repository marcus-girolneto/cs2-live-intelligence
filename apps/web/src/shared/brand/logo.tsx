import { useId } from "react";
import { BRAND } from "./brand";

/*
 * FRAGMIND mark: a crosshair ring (four gaps, four ticks) whose centre is a brain made of
 * two hemispheres wired with circuit traces. The vertical gap between the hemispheres is the
 * crosshair's own vertical line, with the centre dot sitting in it.
 * Drawn on a 64-unit grid. Below 24 px a simplified "mini" variant keeps it crisp.
 */
const LEFT =
  "M29.5 15.5C24 13.8 18.4 16.6 17.6 21.6 14.2 23.4 13.4 29.6 15.9 32.6 13.8 36.8 16.4 42.6 21.4 43.6 23.4 47.8 27.8 48.6 29.5 46.9Z";
const RIGHT =
  "M34.5 15.5C40 13.8 45.6 16.6 46.4 21.6 49.8 23.4 50.6 29.6 48.1 32.6 50.2 36.8 47.6 42.6 42.6 43.6 40.6 47.8 36.2 48.6 34.5 46.9Z";
const TRACES = [
  "M29.5 22.5H24.5L21.5 25.5",
  "M29.5 31H19.5",
  "M29.5 39.5H25L22 36.5",
  "M34.5 22.5H39.5L42.5 25.5",
  "M34.5 31H44.5",
  "M34.5 39.5H39L42 36.5",
];
const NODES: [number, number][] = [
  [21.5, 25.5],
  [19.5, 31],
  [22, 36.5],
  [42.5, 25.5],
  [44.5, 31],
  [42, 36.5],
];
const TICKS = "M32 1.5V10.5M32 53.5V62.5M1.5 32H10.5M53.5 32H62.5";
// Ring r=26: circumference 163.4, four arcs separated by four 12-unit gaps at N/E/S/W.
const RING_DASH = "28.85 12";
const RING_OFFSET = -6;

export function LogoMark({
  size = 32,
  animated = false,
  variant,
  title,
  className = "",
}: {
  size?: number;
  animated?: boolean;
  variant?: "full" | "mini";
  title?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const mini = (variant ?? (size <= 22 ? "mini" : "full")) === "mini";
  const grad = `lg-${id}`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`logo-mark ${animated ? "logo-anim" : ""} ${className}`}
      {...(title
        ? { role: "img", "aria-label": title }
        : { "aria-hidden": true })}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.55" stopColor="#f2a93b" />
          <stop offset="1" stopColor="#ff7a2f" />
        </linearGradient>
      </defs>
      <g className="lg-ring-wrap">
        <circle
          className="lg-ring"
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke={`url(#${grad})`}
          strokeWidth={mini ? 6 : 3.6}
          strokeDasharray={RING_DASH}
          strokeDashoffset={RING_OFFSET}
        />
      </g>
      <path
        className="lg-ticks"
        d={TICKS}
        stroke={`url(#${grad})`}
        strokeWidth={mini ? 6 : 3.6}
        strokeLinecap="square"
        fill="none"
      />
      {mini ? (
        <>
          <path d={LEFT} fill="#e9eef4" />
          <path d={RIGHT} fill="#e9eef4" />
          <path
            d="M29.5 24.5H22M29.5 37.5H22M34.5 24.5H42M34.5 37.5H42"
            stroke="#0b0f14"
            strokeWidth="3.4"
            fill="none"
          />
        </>
      ) : (
        <>
          <path
            className="lg-hemi"
            d={LEFT}
            fill="rgba(233,238,244,0.06)"
            stroke="#e9eef4"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            className="lg-hemi"
            d={RIGHT}
            fill="rgba(233,238,244,0.06)"
            stroke="#e9eef4"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <g
            className="lg-traces"
            stroke={`url(#${grad})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            {TRACES.map((d, i) => (
              <path
                key={d}
                d={d}
                className="lg-trace"
                pathLength={1}
                style={{
                  animationDelay: `${(i % 3) * 0.22 + (i > 2 ? 0.11 : 0)}s`,
                }}
              />
            ))}
          </g>
          <g className="lg-nodes" fill="#ffc561">
            {NODES.map(([cx, cy], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="1.9"
                style={{
                  animationDelay: `${(i % 3) * 0.22 + (i > 2 ? 0.11 : 0) + 0.3}s`,
                }}
              />
            ))}
          </g>
        </>
      )}
      <circle
        className="lg-dot"
        cx="32"
        cy="32"
        r={mini ? 2.6 : 1.9}
        fill="#ffc561"
      />
    </svg>
  );
}

/** Display wordmark: FRAG in white, MIND in the accent colour, wide tracking. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`}>
      {BRAND.parts[0]}
      <b>{BRAND.parts[1]}</b>
    </span>
  );
}

/** Mark + wordmark lockup. */
export function Logo({
  size = 32,
  animated = false,
  stacked = false,
  className = "",
}: {
  size?: number;
  animated?: boolean;
  stacked?: boolean;
  className?: string;
}) {
  return (
    <span className={`logo ${stacked ? "logo-stacked" : ""} ${className}`}>
      <LogoMark size={size} animated={animated} />
      <Wordmark />
    </span>
  );
}

/** Loader: the mark with traces lighting up and the ring turning. */
export function LogoLoader({
  size = 96,
  label,
}: {
  size?: number;
  label?: string;
}) {
  return (
    <span
      className="logo-loader"
      role={label ? "status" : undefined}
      style={{ width: size, height: size }}
    >
      <LogoMark size={size} animated />
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}
