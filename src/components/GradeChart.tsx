"use client";

import { useCallback, useId, useRef, useState } from "react";
import { SeriesPoint } from "@/lib/grades";
import { formatDate } from "@/lib/dates";

/**
 * Running-average line for one course. The question a student asks of this
 * chart is "am I going up or down", so the y-axis is clamped to the range the
 * data actually occupies (padded, min 20 points) rather than a full 0–100 —
 * a flat line across the middle of an empty chart answers nothing.
 */
export function GradeChart({
  points,
  height = 132,
  showAxis = true,
}: {
  points: SeriesPoint[];
  height?: number;
  showAxis?: boolean;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const { ref: wrapRef, width } = useElementWidth(320);

  if (points.length < 2) {
    return (
      <div
        ref={wrapRef}
        className="flex items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-3"
        style={{ height }}
      >
        {points.length === 0 ? "No grades yet" : "Add a second grade to see the trend"}
      </div>
    );
  }

  // Drawn at the container's real pixel width rather than a fixed viewBox, so
  // the line fills its card instead of being letterboxed inside a fixed aspect
  // ratio — and the stroke keeps its intended weight at any size.
  const W = width;
  const H = height;
  const padL = showAxis ? 30 : 4;
  const padR = 4;
  const padT = 10;
  const padB = showAxis ? 18 : 6;

  const values = points.flatMap((p) => [p.value, p.score]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(20, rawMax - rawMin + 8);
  const mid = (rawMax + rawMin) / 2;
  const min = Math.max(0, Math.min(rawMin - 4, mid - span / 2));
  const max = Math.min(100, Math.max(rawMax + 4, min + span));

  const x = (i: number) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;

  const ticks = [max, (max + min) / 2, min].map((v) => Math.round(v));
  const active = hover != null ? points[hover] : null;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Grade average over time, from ${points[0].value}% to ${points[points.length - 1].value}%`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {showAxis &&
          ticks.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y(t) + 3}
                textAnchor="end"
                className="nums"
                fontSize="10"
                fill="var(--text-3)"
              >
                {t}
              </text>
            </g>
          ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <circle
            key={`${p.date}-${i}`}
            cx={x(i)}
            cy={y(p.value)}
            r={hover === i ? 4.5 : 3}
            fill="var(--panel)"
            stroke="var(--accent)"
            strokeWidth="1.6"
          />
        ))}

        {/* Invisible hit areas — the dots themselves are too small to target. */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.date}-${i}`}
            x={x(i) - (W - padL - padR) / (points.length * 2)}
            y={0}
            width={(W - padL - padR) / points.length}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {active && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-line bg-panel px-2 py-1 text-[11px] shadow-[var(--shadow)]">
          <span className="font-medium">{active.label}</span>
          <span className="nums text-ink-2">
            {" "}
            · scored {active.score}% · average {active.value}%
          </span>
          <span className="text-ink-3"> · {formatDate(active.date)}</span>
        </div>
      )}
    </div>
  );
}

/** Compact, axis-free version for course cards. */
export function Sparkline({ points }: { points: SeriesPoint[] }) {
  return <GradeChart points={points} height={40} showAxis={false} />;
}

/**
 * Tracks an element's rendered width. Charts need real pixels: an SVG with a
 * fixed viewBox scales to fit, which letterboxes it in a container of a
 * different aspect ratio and makes strokes and labels shrink with it.
 */
function useElementWidth(fallback: number) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);

  // A callback ref rather than useRef + useEffect: the chart swaps between an
  // empty-state div and the svg wrapper when the first grades arrive, and a
  // mount-only effect would go on observing the detached element.
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (next > 0) setWidth(next);
    });
    observer.current.observe(el);
  }, []);

  return { ref, width };
}
