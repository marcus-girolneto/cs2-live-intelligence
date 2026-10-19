import { icon } from "./icon";

export const Crosshair = icon(
  <>
    <path d="M12 2.5v6M12 15.5v6M2.5 12h6M15.5 12h6" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </>,
);
export const Scope = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </>,
);
export const Skull = icon(
  <>
    <path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.5 1.2 4.3 2.9 5.4V19a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1v-3.1c1.7-1.1 2.9-2.9 2.9-5.4A7.5 7.5 0 0 0 12 3Z" />
    <path
      d="M8.2 10.4c0-.9.8-1.4 1.7-1.4s1.4.7 1.4 1.5-.7 1.6-1.6 1.6-1.5-.8-1.5-1.7ZM12.7 10.5c0-.8.5-1.5 1.4-1.5s1.7.5 1.7 1.4-.6 1.7-1.5 1.7-1.6-.8-1.6-1.6Z"
      fill="currentColor"
    />
    <path d="M12 13.2l-.8 1.6h1.6zM10.3 20v-2M13.7 20v-2" />
  </>,
);
export const Headshot = icon(
  <>
    <circle cx="12" cy="9" r="4.6" />
    <path d="M4.5 21.5c.9-3.9 3.9-6.3 7.5-6.3s6.6 2.4 7.5 6.3" />
    <path d="M12 2v2.2M12 13.8V16M5 9h2.2M16.8 9H19" />
    <circle cx="12" cy="9" r="1" fill="currentColor" stroke="none" />
  </>,
);
export const Damage = icon(
  <path d="M13.5 2 4.5 13.5h6.5l-1 8.5 9-11.5h-6.5l1-8.5Z" />,
);
export const Bomb = icon(
  <>
    <rect x="3" y="7.5" width="18" height="12" rx="1.5" />
    <rect x="6" y="10.5" width="6" height="3" rx=".5" />
    <path d="M6.5 16.5h1M9 16.5h1M11.5 16.5h1M15 10.5v6M17.5 10.5v6M8 7.5V5.5c0-1 .8-1.5 1.6-1.5h4.8c.8 0 1.6.5 1.6 1.5v2" />
  </>,
);
export const DefuseKit = icon(
  <>
    <path d="M8.5 3.5 6 10l2.5 1.5L12 6M15.5 3.5 18 10l-2.5 1.5L12 6" />
    <rect x="5" y="12" width="14" height="8.5" rx="1.5" />
    <path d="M9 16.2h6" />
  </>,
);
export const Kevlar = icon(
  <path d="M8 3 5 5v5l1.5 2L5 14v6h14v-6l-1.5-2L19 10V5l-3-2-1.5 2.5h-5L8 3Zm1 6h6M9 14h6" />,
);
export const Helmet = icon(
  <>
    <path d="M3.5 15.5a8.5 8.5 0 0 1 17 0v1.5h-17z" />
    <path d="M3 17h18M12 7v4M8 9.5l1.5 2M16 9.5l-1.5 2" />
  </>,
);
export const Flashbang = icon(
  <>
    <rect x="8" y="7" width="8" height="14" rx="2" />
    <path d="M8 11h8M10 7V4.5h4V7M14 4.5l3-1.5" />
    <path d="M3 9.5 1.5 8.5M3.5 13H1.5M21 9.5l1.5-1M20.5 13h2" />
  </>,
);
export const Smoke = icon(
  <>
    <rect x="9" y="9" width="6" height="12" rx="1.2" />
    <path d="M9 13h6M11 9V7h2v2" />
    <path d="M7.5 6.5a2.5 2.5 0 0 1 3-3.5 3 3 0 0 1 5.5.5 2.2 2.2 0 0 1 .5 4.3" />
  </>,
);
export const HeGrenade = icon(
  <>
    <circle cx="11" cy="14" r="6.5" />
    <path d="M9 7.8V5h4v2.8M13 5l4.5-1.5M15 6l3 3M8 12.5h6M8 15.5h6" />
  </>,
);
export const Molotov = icon(
  <>
    <path d="M9.5 9h5v2.2c1.5.8 2.5 2.4 2.5 4.3V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-4.5c0-1.9 1-3.5 2.5-4.3z" />
    <path d="M9.5 9V7h5v2M12 7c-1.5-1.2-1.2-2.8 0-4.5 1.2 1.7 1.5 3.3 0 4.5ZM7 15.5h10" />
  </>,
);
export const Flame = icon(
  <path d="M12 21.5c3.8 0 6.5-2.6 6.5-6.2 0-3.4-2.4-5.4-3.6-8.8-.4 2-1.3 3.2-2.4 3.7C12.7 7 11 4.3 8.6 2.5c.3 3.2-1.4 5.1-2.5 6.9-.8 1.3-1.6 2.7-1.6 4.8 0 4.4 3.3 7.3 7.5 7.3Z" />,
);
export const Trophy = icon(
  <path d="M7 3.5h10v5.5a5 5 0 0 1-10 0V3.5ZM7 5.5H4a3 3 0 0 0 3 4M17 5.5h3a3 3 0 0 1-3 4M9 20.5h6M12 14v6.5" />,
);
export const MapPin = icon(
  <>
    <path d="M12 21.5s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10.5" r="2.3" />
  </>,
);
export const Clock = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const Timer = icon(
  <>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5V6M18.5 6.5l1.5-1.5" />
  </>,
);
export const Money = icon(
  <>
    <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9.5v5M18 9.5v5" />
  </>,
);
export const Upload = icon(
  <path d="M12 15.5V4M7 8.5l5-5 5 5M4 15.5v3.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3.5" />,
);
export const Signal = icon(
  <>
    <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2M8.1 8.1a5.5 5.5 0 0 0 0 7.8M15.9 8.1a5.5 5.5 0 0 1 0 7.8" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
  </>,
);
export const Play = icon(<path d="M7.5 4.5v15l12-7.5-12-7.5Z" />);
export const Pause = icon(<path d="M8 5v14M16 5v14" />);
export const Shield = icon(
  <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6L12 3Z" />,
);
export const ShieldCheck = icon(
  <>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6L12 3Z" />
    <path d="m8.8 12 2.3 2.3 4.2-4.6" />
  </>,
);
export const ShieldAlert = icon(
  <>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.3 7.5 9.5 4.3-1.2 7.5-5 7.5-9.5V6L12 3Z" />
    <path d="M12 8v4.5M12 15.5v.5" />
  </>,
);
export const Gear = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3.5a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.4 10h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1 1Z" />
  </>,
);
export const User = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c.8-3.7 3.8-6 7.5-6s6.7 2.3 7.5 6" />
  </>,
);
export const Users = icon(
  <>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 19.5c.7-3.2 3.3-5 6.5-5s5.8 1.8 6.5 5M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.6c2.1.6 3.6 2.3 4 4.9" />
  </>,
);
export const Trend = icon(
  <>
    <path d="M3 17.5 9 11.5l4 4 8-8.5" />
    <path d="M15.5 7h5.5v5.5" />
  </>,
);
export const Chart = icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const Target = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </>,
);
