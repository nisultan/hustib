"use client";

/**
 * Switching theme as a wipe rather than a blink.
 *
 * A theme change repaints every surface on screen at once. Done instantly it
 * reads as a fault — the eye catches the discontinuity before it understands
 * what happened, which is the same signal a page gives when something has
 * gone wrong. Spending half a second on it turns the same event into a
 * deliberate one.
 *
 * The new theme is revealed by a circle growing from wherever the switch was
 * pressed, so the change has an origin and a direction: it came from the thing
 * you touched. That is done with the View Transitions API, which snapshots the
 * old frame and the new one for us — animating the real page would mean
 * animating every element on it.
 *
 * `apply` must change the theme synchronously, which `applyTheme` does by
 * writing the attribute on <html> itself: the snapshot the browser takes is of
 * the DOM as it stands when the callback returns, so a theme that only lands in
 * a later React render is a theme the animation never sees. Forcing that render
 * with `flushSync` is what the obvious version of this does, and React refuses
 * it from inside the callback — the transition then fails silently and the
 * theme does not change at all.
 *
 * Nothing about this is load-bearing. Where the API is missing, or the student
 * has asked for less motion, the theme simply changes, which is what happened
 * before this existed.
 */

type WithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

/** How long the circle takes to cover the screen. */
const DURATION = 480;

export function withThemeTransition(
  apply: () => void,
  origin?: { x: number; y: number },
): void {
  const doc = document as WithViewTransition;

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A hidden document does not paint, and a transition started in one can sit
  // unfinished with the snapshot overlay still covering the page — which looks
  // exactly like the app having frozen. The theme is worth less than that.
  const hidden = typeof document !== "undefined" && document.visibilityState !== "visible";

  if (typeof doc.startViewTransition !== "function" || reduced || hidden) {
    apply();
    return;
  }

  // The centre of the screen is the honest fallback when the change did not
  // come from a pointer at all — a keyboard press, or the picker in Settings.
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;

  // Far enough to reach whichever corner is furthest away, or the circle stops
  // growing while part of the old theme is still on screen.
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = doc.startViewTransition(apply);

  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: DURATION,
          easing: "cubic-bezier(0.32, 0.72, 0, 1)",
          // Only the incoming snapshot is clipped. The outgoing one stays put
          // underneath, so the new theme is wiped over the old rather than
          // both of them cross-fading into a grey halfway house.
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      // A transition can be abandoned — a second press mid-wipe, a navigation.
      // The theme has already been applied either way, so there is nothing to
      // put right.
    });
}
