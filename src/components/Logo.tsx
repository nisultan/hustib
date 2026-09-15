import { CSSProperties } from "react";

/**
 * The mark.
 *
 * It is the sparkline the courses and grades pages already draw — a path
 * climbing over three points, with the area beneath it filled. Using the
 * product's own chart as its logo means the identity is derived from the
 * thing it does rather than decorating it: the whole hub exists to show a
 * student where they stand and which way it is going, and that is the shape.
 *
 * The last node is drawn solid and slightly larger. A trend line has no
 * meaning without a "you are here", and it also gives the silhouette an
 * asymmetric weight that survives being shrunk to a favicon.
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
      {/* The area under the curve, which is what stops the mark reading as a
          bare icon at large sizes. */}
      <path
        d="M4 15.4 L9.4 10.2 L13.8 13.1 L20 6.4 V19 H4 Z"
        fill="currentColor"
        opacity="0.24"
      />
      <path
        d="M4 15.4 L9.4 10.2 L13.8 13.1 L20 6.4"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="6.4" r="2.5" fill="currentColor" />
    </svg>
  );
}

const TILE_RADIUS: Record<Size, string> = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
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
 * The inner highlight is the same one the buttons carry, so the logo belongs
 * to the same surface family as everything else rather than floating on top
 * of it.
 */
export function Logo({ size = "md", className = "" }: { size?: Size; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center bg-accent text-white shadow-[var(--shadow),inset_0_1px_0_rgba(255,255,255,0.22)] ${TILE_SIZE[size]} ${TILE_RADIUS[size]} ${className}`}
    >
      <LogoMark className={MARK_SIZE[size]} />
    </span>
  );
}
