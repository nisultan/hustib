import { CSSProperties } from "react";

/**
 * The mark.
 *
 * Still the thing the hub does — a line showing where a student stands and
 * which way it is going — but drawn as a measurement rather than as a
 * flourish. The earlier version filled the area under the curve and capped it
 * with a large dot, which read as friendly and slightly soft; this one keeps
 * the same gesture and takes the decoration out.
 *
 * The axis is what does most of the work. A line on its own is a squiggle; a
 * line against a corner is a reading against a scale, and that is the whole
 * difference between a mark that looks like an app icon and one that looks
 * like an instrument. It also fixes the silhouette — the corner anchors the
 * bottom-left, so the composition stays put at any size instead of drifting.
 *
 * Square caps and mitred joins throughout. Round ones soften every corner, and
 * softness is precisely what was being asked to go.
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
      {/* The scale. Held back in weight and opacity so it reads as the ground
          the line is measured against, not as part of the line. */}
      <path
        d="M5.2 4.5 V18.8 H19.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="square"
        strokeLinejoin="miter"
        opacity="0.5"
      />

      {/* Three segments, rising. Two would be a corner and four is a scribble
          at sixteen pixels; three is the fewest that reads as a trend with a
          setback in it, which is the honest shape of a term. */}
      <path
        d="M8 14.6 L11.9 10.3 L14.9 12.4 L19.6 6.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeMiterlimit="3"
      />
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
  sm: "size-4",
  md: "size-[18px]",
  lg: "size-7",
};

type Size = "sm" | "md" | "lg";

/**
 * The mark on its accent tile, which is how it appears everywhere in the app.
 *
 * No inner highlight any more. The gloss belonged to the button family and
 * made the logo look like something to press; a mark should sit flat and let
 * the controls be the things that catch the light. The corners are tighter for
 * the same reason — a softer radius reads as a toy at this size.
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
