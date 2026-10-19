import { icon } from "./icon";
import { Users } from "./game";

export const Eye = icon(
  <>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const Radar = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <path d="M12 12 18.4 5.6" />
    <circle cx="15" cy="8.5" r="1" fill="currentColor" />
  </>,
);
export const Brain = icon(
  <>
    <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3 2.5 2.5 0 0 0 3-1V5a2.5 2.5 0 0 0-3-1ZM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3 2.5 2.5 0 0 1-3-1" />
    <path d="M12 9h-2M12 14h-2.5M14 11h-2" />
  </>,
);
export const Sparkle = icon(
  <path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7ZM19 15.5c.3 1.7 1 2.4 2.5 2.7-1.5.3-2.2 1-2.5 2.7-.3-1.7-1-2.4-2.5-2.7 1.5-.3 2.2-1 2.5-2.7Z" />,
);
export const Star = icon(
  <path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3.2Z" />,
);
export const Monitor = icon(
  <>
    <rect x="2.5" y="4" width="19" height="13" rx="1.5" />
    <path d="M8.5 20.5h7M12 17v3.5" />
  </>,
);
export const Refresh = icon(
  <>
    <path d="M20 11.5A8 8 0 0 0 5.6 6.6L4 8.5M4 12.5a8 8 0 0 0 14.4 4.9l1.6-1.9" />
    <path d="M4 3.5v5h5M20 20.5v-5h-5" />
  </>,
);
export const Logout = icon(
  <path d="M15 4h3.5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H15M10 16.5 14.5 12 10 7.5M14.5 12H3.5" />,
);
export const Menu = icon(<path d="M4 7h16M4 12h16M4 17h10" />);
export const Close = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const ChevronRight = icon(<path d="m9 5 7 7-7 7" />);
export const ChevronDown = icon(<path d="m5 9 7 7 7-7" />);
export const ArrowRight = icon(<path d="M4 12h15M13 6l6 6-6 6" />);
export const ArrowUp = icon(<path d="M12 20V5M6 11l6-6 6 6" />);
export const ArrowDown = icon(<path d="M12 4v15M6 13l6 6 6-6" />);
export const Check = icon(<path d="m4.5 12.5 5 5 10-11" />);
export const Alert = icon(
  <>
    <path d="M12 3.5 2.5 20h19L12 3.5Z" />
    <path d="M12 10v4.5M12 17.2v.3" />
  </>,
);
export const Info = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8v.2" />
  </>,
);
export const Lock = icon(
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="1.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </>,
);
export const Key = icon(
  <>
    <circle cx="8" cy="15" r="4.5" />
    <path d="m11.2 11.8 9-9M17 6l3 3M14.5 8.5l2 2" />
  </>,
);
export const Server = icon(
  <>
    <rect x="3" y="3.5" width="18" height="7" rx="1.5" />
    <rect x="3" y="13.5" width="18" height="7" rx="1.5" />
    <path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" />
  </>,
);
export const ListIcon = icon(
  <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
);
export const Globe = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
  </>,
);
export const Database = icon(
  <>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
    <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
  </>,
);
export const Trash = icon(
  <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 13.5h10l1-13.5M10 10.5v6M14 10.5v6" />,
);
export const Plus = icon(<path d="M12 5v14M5 12h14" />);
export const Search = icon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.4-4.4" />
  </>,
);
export const External = icon(
  <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
);
export const Copy = icon(
  <>
    <rect x="8.5" y="8.5" width="12" height="12" rx="1.5" />
    <path d="M15.5 8.5V5a1 1 0 0 0-1-1h-9.5a1 1 0 0 0-1 1v9.5a1 1 0 0 0 1 1h3.5" />
  </>,
);
export const Gamepad = icon(
  <>
    <path d="M7.5 7h9a5 5 0 0 1 4.8 6.3l-1 3.8a2.3 2.3 0 0 1-4 .8L14.5 16h-5l-1.8 1.9a2.3 2.3 0 0 1-4-.8l-1-3.8A5 5 0 0 1 7.5 7Z" />
    <path d="M7.5 10.5v3M6 12h3M15.5 11h.01M17.5 13h.01" />
  </>,
);
export const Medal = icon(
  <>
    <circle cx="12" cy="15" r="5.5" />
    <path d="M8.5 10.7 5.5 3h4l2.5 5.5L14.5 3h4l-3 7.7M12 12.6v4.8M9.6 15h4.8" />
  </>,
);
export const Film = icon(
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
    <path d="M7 4.5v15M17 4.5v15M3 9h4M3 15h4M17 9h4M17 15h4" />
  </>,
);
export const Download = icon(<path d="M12 3.5v12M7 10.5l5 5 5-5M4.5 20h15" />);
export const Loop = icon(
  <path d="M17 3.5 20 6.5l-3 3M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3M20 12.5v1a4 4 0 0 1-4 4H4" />,
);
export const Crown = icon(
  <path d="M3.5 8 8 12l4-6.5 4 6.5 4.5-4-2 11h-13l-2-11ZM5.5 19h13" />,
);
export const Card = icon(
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 9.5h19M6 15h4" />
  </>,
);
export const Dumbbell = icon(
  <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />,
);
export const Friends = Users;
export const Hourglass = icon(
  <path d="M6.5 3h11M6.5 21h11M7.5 3c0 4.5 4.5 5.5 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 5.5-4.5 9s4.5 4.5 4.5 9" />,
);
export const Wallbang = icon(
  <>
    <path d="M10 3v18M14 3v18" strokeDasharray="2 2" />
    <path d="M2.5 12h19M18 8.5l3.5 3.5-3.5 3.5" />
  </>,
);

/** A generic "sign in through the platform" mark (not a vendor logo). */
export const SignInMark = icon(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <circle cx="15.5" cy="9" r="2.6" />
    <circle cx="9" cy="15.5" r="1.8" />
    <path d="m10.5 14.2 3.2-3.4" />
  </>,
);
/** Credit coin: a hexagonal token with a notch (tactical, not a currency sign). */
export const Coin = icon(
  <>
    <path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4L12 2.8Z" />
    <path d="M12 7v10M9.2 9.5 12 7l2.8 2.5M9.2 14.5 12 17l2.8-2.5" />
  </>,
);
export const Gift = icon(
  <>
    <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
    <path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5S10.8 4 8.2 4.4C6 4.8 6.6 8.5 12 8.5ZM12 8.5S13.2 4 15.8 4.4c2.2.4 1.6 4.1-3.8 4.1Z" />
  </>,
);
/** Lightning bolt: the Quick review. */
export const Bolt = icon(<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6l1-8Z" />);
/** Stacked layers: the Deep review. */
export const Layers = icon(
  <>
    <path d="m12 3 9 4.8-9 4.8-9-4.8L12 3Z" />
    <path d="m3 12.2 9 4.8 9-4.8M3 16.4l9 4.8 9-4.8" />
  </>,
);
/** Two columns with arrows: side-by-side comparison. */
export const Compare = icon(
  <>
    <rect x="3" y="4" width="7" height="16" rx="1" />
    <rect x="14" y="4" width="7" height="16" rx="1" />
    <path d="M10 12h4M12.5 10.5 14 12l-1.5 1.5" />
  </>,
);
export const Share = icon(
  <>
    <circle cx="18" cy="5.5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" />
  </>,
);
