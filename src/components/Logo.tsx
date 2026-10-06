import { CSSProperties } from "react";

/**
 * The mark.
 *
 * Four brackets closing on a point: a focus lock, the thing a camera or a
 * sight does when it has found what it is looking for. With the name it is
 * almost literal — locked in is what the corners have just done — and it says
 * the thing the app is actually for, which is not storing your week but
 * narrowing it down to the one thing in front of you.
 *
 * Two earlier attempts were a chart line, filled and then bare against an
 * axis. Both described what the hub contains. This describes what it is for,
 * which turns out to be the more interesting half, and it has the silhouette
 * neither of them had: a shape with a centre reads instantly at any size,
 * where a diagonal line is just a diagonal line once it gets small enough.
 *
 * The brackets are open, deliberately. A closed square is a box and boxes are
 * where things get put away; the gaps are what make it read as something being
 * held in view.
 */
export function LogoMark({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} style={style}>
      <g
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.9 9V6.7A1.8 1.8 0 0 1 6.7 4.9H9" />
        <path d="M15 4.9h2.3A1.8 1.8 0 0 1 19.1 6.7V9" />
        <path d="M19.1 15v2.3a1.8 1.8 0 0 1-1.8 1.8H15" />
        <path d="M9 19.1H6.7a1.8 1.8 0 0 1-1.8-1.8V15" />
      </g>

      {/* The thing being held. Solid, and the only filled shape in the mark —
          at a favicon's size the brackets become texture and this stays the
          part you actually see. */}
      <circle cx="12" cy="12" r="2.7" fill="currentColor" />
    </svg>
  );
}

const TILE_RADIUS: Record<Size, string> = {
  sm: "rounded-[5px]",
  md: "rounded-md",
  lg: "rounded-[10px]",
};

const TILE_SIZE: Record<Size, string> = {
  sm: "size-6",
  md: "size-7",
  lg: "size-11",
};

const MARK_SIZE: Record<Size, string> = {
  sm: "size-[15px]",
  md: "size-[18px]",
  lg: "size-7",
};

type Size = "sm" | "md" | "lg";

/**
 * The mark on its accent tile, which is how it appears everywhere in the app.
 *
 * Flat, with no inner highlight: the gloss belonged to the button family and
 * made the logo look like something to press.
 */
export function Logo({ size = "md", className = "" }: { size?: Size; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center bg-accent text-white ${TILE_SIZE[size]} ${TILE_RADIUS[size]} ${className}`}
    >
      <LogoMark className={MARK_SIZE[size]} />
    </span>
  );
}
