"use client";

/**
 * The streak flame.
 *
 * Was an emoji, which is the wrong tool twice over: it renders as a different
 * picture on every platform — Apple's is a cartoon, Windows' is flat, Android's
 * is a third thing — and none of them can carry information. This one can. It
 * gets taller, hotter and quicker as the run gets longer, so a 40-day streak
 * and a 3-day streak no longer look identical beside different numbers.
 *
 * The flicker is two counter-rotating phases rather than one pulse. A single
 * scale animation reads as a throb, which looks like a notification demanding
 * attention; offsetting the inner core against the body gives the irregular,
 * self-absorbed motion a flame actually has, and it stops the eye locking onto
 * a beat.
 *
 * Motion is capped early. This sits in a list of a dozen habits, and twelve
 * synchronised flames would turn a quiet page into a fairground.
 */

/** Where a run stops being new and starts being a habit. */
const HOT = 30;

export function Flame({ streak, className = "" }: { streak: number; className?: string }) {
  // 0 at one day, 1 at a month. Everything else is interpolated off this.
  const heat = Math.min(1, Math.max(0, (streak - 1) / (HOT - 1)));

  // A young flame is amber and still; an established one burns toward white
  // at the core and moves a little faster.
  const body = heat < 0.5 ? "var(--high)" : "var(--urgent)";
  const core = heat < 0.5 ? "var(--medium)" : "var(--high)";
  const duration = 2.6 - heat * 0.9;

  return (
    <span
      aria-hidden
      className={`inline-grid place-items-center ${className}`}
      style={{ width: 13, height: 15 }}
    >
      <svg viewBox="0 0 14 16" className="size-full overflow-visible">
        {/* The body. Drawn as one closed path rather than a teardrop plus a
            base, so the silhouette stays a flame at nine pixels. */}
        <path
          d="M7 .8c2.6 2.9 4.9 4.6 4.9 8A4.9 4.9 0 0 1 7 15.2 4.9 4.9 0 0 1 2.1 8.8c0-2 .9-3.3 2-4.6.3 1.1.8 1.9 1.5 2.3C5.3 4.3 5.8 2.3 7 .8Z"
          fill={body}
          style={{
            transformOrigin: "50% 95%",
            animation: `flame-body ${duration}s ease-in-out infinite`,
          }}
        />

        {/* The core, running on its own clock and a little slower, which is
            what keeps the two from ever lining up into a pulse. */}
        <path
          d="M7 6.6c1.3 1.5 2.2 2.4 2.2 4a2.2 2.2 0 0 1-4.4 0c0-1.3.9-2.4 2.2-4Z"
          fill={core}
          style={{
            transformOrigin: "50% 95%",
            animation: `flame-core ${duration * 1.35}s ease-in-out infinite`,
            opacity: 0.55 + heat * 0.45,
          }}
        />
      </svg>
    </span>
  );
}
