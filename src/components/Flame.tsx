"use client";

import { useId } from "react";

/**
 * The streak flame.
 *
 * Built like a real flame rather than a flat icon:
 *
 *  - Three tongues — a red outer, an orange middle, a pale yellow-white core —
 *    each filled with a vertical gradient (hotter at the base, cooling to the
 *    tip) and each on its own clock, swaying, stretching and skewing. Because
 *    the durations never line up, the shape never repeats into a pulse.
 *  - A soft glow behind it that flickers in brightness on yet another clock.
 *  - Embers that drift up and fade, once a streak is a week or more — more of
 *    them, faster, as it gets hotter.
 *
 * Size, speed and heat all scale with the streak, so 3 days and 40 days look
 * different. Respects reduced motion (see globals.css).
 */

/** Where a run stops being new and starts being a habit. */
const HOT = 30;

export function Flame({ streak, className = "" }: { streak: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  // 0 at one day, 1 at a month.
  const heat = Math.min(1, Math.max(0, (streak - 1) / (HOT - 1)));
  const speed = 1.6 - heat * 0.6; // seconds per sway, quicker when hot
  const scale = 0.9 + heat * 0.25;
  const embers = streak >= 7 ? (heat > 0.6 ? 3 : 2) : 0;

  return (
    <span
      aria-hidden
      className={`flame relative inline-grid place-items-center ${className}`}
      style={{ width: 14 * scale, height: 17 * scale }}
    >
      <svg viewBox="0 0 20 24" className="size-full overflow-visible">
        <defs>
          <linearGradient id={`${id}o`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff3d00" />
            <stop offset="55%" stopColor="#ff6a1a" />
            <stop offset="100%" stopColor="#ff9f1c" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`${id}m`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff8a00" />
            <stop offset="100%" stopColor="#ffc533" />
          </linearGradient>
          <linearGradient id={`${id}c`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#fff7d6" />
            <stop offset="100%" stopColor="#ffe066" />
          </linearGradient>
          <radialGradient id={`${id}g`} cx="50%" cy="70%" r="50%">
            <stop offset="0%" stopColor="#ff7a1a" stopOpacity={0.55 + heat * 0.25} />
            <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glow */}
        <ellipse
          cx="10"
          cy="16"
          rx="10"
          ry="9"
          fill={`url(#${id}g)`}
          className="flame-glow"
          style={{ animationDuration: `${speed * 1.3}s` }}
        />

        {/* Outer tongue */}
        <path
          d="M10 1.2c3.4 3.7 6.6 6.3 6.6 11.2A6.6 6.6 0 0 1 10 22.8a6.6 6.6 0 0 1-6.6-6.6c0-2.8 1.2-4.6 2.7-6.3.4 1.6 1.1 2.6 2 3.2C7.6 9.6 8.3 4.6 10 1.2Z"
          fill={`url(#${id}o)`}
          className="flame-outer"
          style={{ animationDuration: `${speed}s` }}
        />
        {/* Middle tongue */}
        <path
          d="M10.4 7.5c2.2 2.4 4 4.2 4 7.3a4.4 4.4 0 0 1-8.8 0c0-1.7.8-2.9 1.8-4 .3 1 .7 1.6 1.3 2 0-2 .5-3.7 1.7-5.3Z"
          fill={`url(#${id}m)`}
          className="flame-mid"
          style={{ animationDuration: `${speed * 0.83}s` }}
        />
        {/* Core */}
        <path
          d="M10 12.5c1.3 1.5 2.3 2.6 2.3 4.3a2.3 2.3 0 0 1-4.6 0c0-1.6 1-2.8 2.3-4.3Z"
          fill={`url(#${id}c)`}
          className="flame-core"
          style={{ animationDuration: `${speed * 1.17}s`, opacity: 0.75 + heat * 0.25 }}
        />

        {/* Embers */}
        {Array.from({ length: embers }, (_, i) => (
          <circle
            key={i}
            cx={8 + i * 2.4}
            cy="8"
            r={0.7 + (i % 2) * 0.3}
            fill="#ffb347"
            className="flame-ember"
            style={{
              animationDuration: `${1.8 + i * 0.5}s`,
              animationDelay: `${i * 0.6}s`,
              ["--drift" as string]: `${(i % 2 ? 1 : -1) * (1.5 + i)}px`,
            }}
          />
        ))}
      </svg>
    </span>
  );
}
