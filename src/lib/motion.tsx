"use client";

import { MotionConfig, Transition, Variants } from "motion/react";
import { ReactNode } from "react";

/**
 * The app's motion vocabulary.
 *
 * The CSS layer in globals.css still handles entrances that only need to play
 * once. Everything here is for the motion CSS cannot do: exits, reordering,
 * shared elements moving between two positions, and gestures. Keeping the
 * curves in one file is what stops the two layers from drifting — a spring
 * here and an ease-out there on the same card reads as two different apps.
 *
 * Durations stay short. This is a tool someone opens twenty times a day, and
 * an animation you notice on the twentieth open is an animation that is too
 * long.
 */

/** Default for anything that travels: overshoots slightly, then settles. */
export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.85,
};

/** Firmer, for shared-element moves that should not wobble under the cursor. */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 620,
  damping: 42,
  mass: 0.7,
};

/**
 * The nav highlight travelling between links.
 *
 * Looser than `springSnappy` on purpose: this shape crosses most of the
 * sidebar's height, and a move that long needs to be readable as a move. It
 * still settles without a visible bounce — the sidebar is furniture, not a
 * toy.
 */
export const springNav: Transition = {
  type: "spring",
  stiffness: 480,
  damping: 38,
  mass: 0.9,
};

/** For opacity and colour, where a spring has nothing to overshoot into. */
export const ease: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };

/** Rows entering, leaving and reordering in a list. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

/** Container that deals its children in, one slightly after the next. */
export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

/** A panel arriving over the page: scales up from just under full size. */
export const dialogPanel: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.14 } },
};

export const backdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

/** The whole route, swapping. */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16 } },
};

/**
 * Wraps the app so every animation below respects the OS setting.
 *
 * `reducedMotion="user"` makes Motion drop transforms and keep opacity when
 * the user has asked for less motion — the same bargain the CSS layer strikes
 * in its `prefers-reduced-motion` block, so the two agree.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={ease}>
      {children}
    </MotionConfig>
  );
}
