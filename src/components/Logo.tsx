import { CSSProperties, useId } from "react";

/**
 * The mark: a padlock whose keyhole is an arrow pointing in.
 *
 * Lock + in, read in one glance. The shackle is drawn as a line, the body is
 * solid, and the arrow is cut out of the body, so on the accent tile it shows
 * the tile colour through it and still reads at favicon size — the solid body
 * is the silhouette, the cut-out is the detail.
 */
export function LogoMark({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} style={style}>
      <defs>
        <mask id={`lk-${id}`}>
          <rect width="24" height="24" fill="#fff" />
          {/* The "in": a chevron dropping into the lock. */}
          <path d="M12 12.4v4.1M9.6 14.4 12 16.8l2.4-2.4" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <path d="M7.8 10.2V7.6a4.2 4.2 0 0 1 8.4 0v1" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      <rect x="4.6" y="10" width="14.8" height="10.6" rx="3.2" fill="currentColor" mask={`url(#lk-${id})`} />
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
