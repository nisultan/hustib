"use client";

import { useMemo } from "react";
import { Day } from "@/lib/types";
import { fromISO } from "@/lib/dates";

/**
 * Weight over time, with a trend line through it.
 *
 * The raw line is drawn faintly and a seven-day mean drawn on top, because
 * day-to-day bodyweight moves a kilo on water alone — reading the raw series
 * as progress is the mistake this chart exists to prevent. The mean is the
 * one you are meant to look at, so it is the one with the weight.
 *
 * Gaps are real: a week with no weigh-in is a gap in the line, not a straight
 * segment implying measurements that never happened.
 */
export function WeightChart({ days, height = 120 }: { days: Day[]; height?: number }) {
  const points = useMemo(() => {
    const weighed = days
      .filter((d): d is Day & { weight: number } => d.weight != null)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (weighed.length === 0) return null;

    const t = (iso: string) => fromISO(iso).getTime();
    const minT = t(weighed[0].date);
    const maxT = t(weighed[weighed.length - 1].date);
    const span = Math.max(maxT - minT, 1);

    const values = weighed.map((d) => d.weight);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    // A flat week should read as flat, not as noise magnified to fill the box.
    const pad = Math.max((hi - lo) * 0.25, 0.5);
    const top = hi + pad;
    const bottom = lo - pad;
    const range = Math.max(top - bottom, 0.1);

    const x = (iso: string) => ((t(iso) - minT) / span) * 100;
    const y = (w: number) => ((top - w) / range) * 100;

    // Seven-day trailing mean, over the days actually recorded in the window
    // rather than over the last seven rows, so a sparse week is not smoothed
    // against a dense one.
    const mean = weighed.map((d, i) => {
      const from = t(d.date) - 6 * 86400000;
      const window = weighed.slice(0, i + 1).filter((w) => t(w.date) >= from);
      const avg = window.reduce((sum, w) => sum + w.weight, 0) / window.length;
      return { x: x(d.date), y: y(avg) };
    });

    // Split the raw series wherever more than a fortnight passes with nothing.
    const segments: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    weighed.forEach((d, i) => {
      const prev = weighed[i - 1];
      if (prev && t(d.date) - t(prev.date) > 14 * 86400000) {
        segments.push(run);
        run = [];
      }
      run.push({ x: x(d.date), y: y(d.weight) });
    });
    segments.push(run);

    return { segments, mean, lo, hi, latest: weighed[weighed.length - 1] };
  }, [days]);

  if (!points) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-dashed border-line text-xs text-ink-3"
        style={{ height }}
      >
        Log a weight to start the chart.
      </div>
    );
  }

  const path = (ps: { x: number; y: number }[]) =>
    ps.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="size-full overflow-visible"
        aria-label={`Weight from ${points.lo.toFixed(1)} to ${points.hi.toFixed(1)} kilograms`}
      >
        <defs>
          <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d={`${path(points.mean)} L100 100 L0 100 Z`}
          fill="url(#weight-fill)"
          stroke="none"
        />

        {points.segments.map((seg, i) => (
          <path
            key={i}
            d={path(seg)}
            fill="none"
            stroke="var(--accent)"
            strokeOpacity="0.28"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        ))}

        <path
          d={path(points.mean)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.mean.length > 0 && (
          <circle
            cx={points.mean[points.mean.length - 1].x}
            cy={points.mean[points.mean.length - 1].y}
            r="3"
            fill="var(--accent)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <span className="nums pointer-events-none absolute right-0 top-0 text-[10px] text-ink-3">
        {points.hi.toFixed(1)}
      </span>
      <span className="nums pointer-events-none absolute bottom-0 right-0 text-[10px] text-ink-3">
        {points.lo.toFixed(1)}
      </span>
    </div>
  );
}
