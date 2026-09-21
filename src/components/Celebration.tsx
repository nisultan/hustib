"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The moment a goal gets ticked off.
 *
 * Everything else in this hub is deliberately quiet — it is a record, not a
 * game, and a burst of confetti for ticking a habit would make the record feel
 * cheap. This is the one exception, and it earns it: a goal is a thing someone
 * carried for months, and the interface that receives that news with a status
 * chip quietly changing colour is the wrong interface.
 *
 * It costs nothing to dismiss and never blocks anything. Auto-clears after a
 * few seconds because a celebration you have to close is a dialog.
 */

const PIECES = 64;

/** Bright enough to read on both backgrounds, and not the accent — this wants
 *  to look like an event rather than like more of the same interface. */
const COLORS = ["#7c6bf0", "#f43f5e", "#f59e0b", "#22c55e", "#0ea5e9", "#e879f9", "#fbbf24"];

interface Piece {
  dx: string;
  dy: string;
  spin: string;
  delay: string;
  duration: string;
  color: string;
  width: number;
  height: number;
  radius: string;
}

export function Celebration({ title, onDone }: { title: string; onDone: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Someone who asked the system for less movement gets the card and no
  // confetti. The message is the substance; the paper is decoration.
  const calm = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  /*
    Randomised once, on mount. Regenerating them on every render would reshuffle
    the burst mid-flight, and a fixed pattern looks like a sprite sheet.
  */
  const pieces = useMemo<Piece[]>(() => {
    if (calm) return [];
    return Array.from({ length: PIECES }, (_, i) => {
      // Spread around the full circle with a little jitter, so the burst is
      // even without being a clock face.
      const angle = (i / PIECES) * Math.PI * 2 + Math.random() * 0.4;
      const reach = 140 + Math.random() * 300;
      const wide = Math.random() < 0.45;
      return {
        dx: `${Math.cos(angle) * reach}px`,
        dy: `${Math.sin(angle) * reach}px`,
        spin: `${(Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540)}deg`,
        delay: `${Math.random() * 120}ms`,
        duration: `${1500 + Math.random() * 900}ms`,
        color: COLORS[i % COLORS.length],
        width: wide ? 9 : 6,
        height: wide ? 5 : 10,
        radius: Math.random() < 0.25 ? "50%" : "1px",
      };
    });
  }, [calm]);

  useEffect(() => {
    const timer = setTimeout(onDone, calm ? 2200 : 4200);
    return () => clearTimeout(timer);
  }, [onDone, calm]);

  // Escape closes it, like everything else that sits over the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (!mounted) return null;

  return createPortal(
    <div
      // Click anywhere to get on with your day.
      onClick={onDone}
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-black/25 backdrop-blur-[2px]"
      style={{ animation: "fade-up 200ms ease-out both" }}
    >
      {/* The burst origin is the middle of the card, not the middle of the
          screen — paper that erupts from behind the news reads as coming from
          it, which is the whole trick. */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-0">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="absolute"
            style={
              {
                width: p.width,
                height: p.height,
                background: p.color,
                borderRadius: p.radius,
                "--dx": p.dx,
                "--dy": p.dy,
                "--spin": p.spin,
                animation: `confetti-burst ${p.duration} cubic-bezier(0.14, 0.7, 0.32, 1) ${p.delay} forwards`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div
        className="relative mx-6 max-w-sm rounded-2xl border border-line bg-panel px-8 py-7 text-center shadow-[var(--shadow-md),var(--edge)]"
        style={{ animation: "spring-in 520ms cubic-bezier(0.2, 1.3, 0.4, 1) both" }}
      >
        <div
          className="mx-auto grid size-14 place-items-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--up) 16%, transparent)",
            color: "var(--up)",
            animation: "pop 600ms cubic-bezier(0.2, 1.4, 0.4, 1) 160ms both",
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-7">
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              // Drawn rather than dropped in: the tick finishing is the beat
              // the whole thing is timed around.
              style={{
                strokeDasharray: 30,
                strokeDashoffset: 30,
                animation: "draw 420ms ease-out 320ms both",
              }}
            />
          </svg>
        </div>

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          Achieved
        </p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-balance">
          {title}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          That one is done. It stays on the page — the record is the point.
        </p>

        <button
          type="button"
          onClick={onDone}
          className="mt-5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Nice
        </button>
      </div>
    </div>,
    document.body,
  );
}
