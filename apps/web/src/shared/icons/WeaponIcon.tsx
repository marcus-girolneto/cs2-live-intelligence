import type { WeaponClass } from "../format/weapons";
type WP = { size?: number; className?: string; cls: WeaponClass | string };
/** Filled weapon silhouettes in a 64×20 box; `size` is the rendered height. */
const WEAPON_PATHS: Record<string, string> = {
  rifle:
    "M1 8.2h9.5l2.3-1.6h18.2l1.1-1.2h3.2l.6 1.2H52v-1h2.6v1H63v1.9h-8.2l-.6.9H41.8l-1.3 1.3h-2.6l-2.8 7.4-3.6-.9 2-6.5h-4.7l-1.7 3.4h-3.7l.9-3.4H14.6L11 14.5H2.4L1 12.1Z",
  sniper:
    "M1 9h10l2-2h9v-2.2h4.5V3.2h11v1.6H41V7h3.2v-.9H63v1.7H44.2l-.4 1.1h-15l-1.7 2.7h-3l-1 6.4h-3.3l.6-6.4H14.7L10.7 14H2.2L1 11.6Z",
  smg: "M6 8.4h2l1.5-1.6h20.5l.9-1.2h2.7l.4 1.2h10.5V5.8h2v1h7.3v2H46.2l-.9 1.1H38l-1.5 7.6h-3.4l1-7.6h-4.3l-1.3 2.6h-3.7l.7-2.6H16.6L13.5 13H8.2L6.5 11Z",
  heavy:
    "M1 8.6h11l2-1.5h20.7l1-1.1h4.4v1.1H63v1.8H40.6l-.7 1.2H24.5l-1.6 3.4h-4.2l.8-3.4H14.5L11.4 14H2.6L1 11.8Z",
  pistol:
    "M14 6.2h31.5l1.1-1h2.3v1H50v3.4H32.8l-1 1.4h-3.5L25.5 18h-7.2l2.8-7H17l-3-2Z",
  knife:
    "M2 10.2c6-3.4 18-5.2 34-4.8l1.2-1h3.4v1.3h2.2v4.2h-2.2v1.3h-3.4l-1.2-1H17.5c-5.7.2-10.6.5-15.5 0Z M42.8 6.5H62v3.3H42.8Z",
  grenade:
    "M26 5.5h8v2.2h-8ZM24 8.5h12a3 3 0 0 1 3 3v4.5a3 3 0 0 1-3 3H24a3 3 0 0 1-3-3v-4.5a3 3 0 0 1 3-3ZM34 5.6l5.5-2.5 1 1.6-5.4 2.4Z",
  other: "M14 7h36l2 3-2 3H14l-2-3Z",
};
export function WeaponIcon({ size = 16, className, cls }: WP) {
  const d = WEAPON_PATHS[cls] ?? WEAPON_PATHS.other;
  return (
    <svg
      width={(size * 64) / 20}
      height={size}
      viewBox="0 0 64 20"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d={d} fillRule="evenodd" />
    </svg>
  );
}
