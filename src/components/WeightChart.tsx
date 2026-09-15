"use client";

import { useMemo } from "react";
import { Day } from "@/lib/types";
import { fromISO } from "@/lib/dates";

/**
 * Weight over time, with a trend line through it.
 *
 * The raw series is drawn faintly and a seven-day mean drawn on top, because
 * day-to-day bodyweight moves a kilo on water alone — reading the raw line as
 * progress is the mistake this chart exists to prevent. The mean is the one
 * you are meant to look at, so it is the one with the weight.
 *
 * Gaps are real: a fortnight with no weigh-in is a gap in the line, not a
 * straight segment implying measurements that never happened.
 */
export function WeightChart({ days, height = 120 }: { days: Day[]; height?: number }) {
  const chart = useMemo(() => build(days), [days]);

  if (chart == null) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-dashed border-line px-4 text-center text-xs text-ink-3"
        style={{ height }}
      >
        Log a weight to start the chart.
      </div>
    );
  }

  // One reading is a fact, not a trend. Drawing a line through it would be
  // inventing the very thing the chart is supposed to report.
  if (chart.kind === "single") {
    return (
      <div className="relative" style={{ height }}>
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        <Marker x={50} y={50} />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[11px] text-ink-3">
          One weigh-in so far — a second gives this a direction.
        </span>
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="size-full"
        aria-label={`Weight between ${chart.lo.toFixed(1)} and ${chart.hi.toFixed(1)} kilograms`}
      >
        <defs>
          <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={`${line(chart.mean)} L100 100 L0 100 Z`} fill="url(#weight-fill)" />

        {chart.segments.map((seg, i) => (
          <path
            key={i}
            d={line(seg)}
            fill="none"
            stroke="var(--accent)"
            strokeOpacity="0.3"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        ))}

        <path
          d={line(chart.mean)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Positioned in HTML rather than drawn in the SVG: the viewBox is
          stretched to the box, so a <circle> in it comes out an ellipse. */}
      <Marker x={chart.last.x} y={chart.last.y} />

      <span className="nums pointer-events-none absolute right-0 top-0 text-[10px] text-ink-3">
        {chart.hi.toFixed(1)}
      </span>
      <span className="nums pointer-events-none absolute bottom-0 right-0 text-[10px] text-ink-3">
        {chart.lo.toFixed(1)}
      </span>
    </div>
  );
}

function Marker({ x, y }: { x: number; y: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-panel"
      style={{ left: `${x}%`, top: `${y}%` }}
    />
  );
}

interface Point {
  x: number;
  y: number;
}

type Chart =
  | { kind: "single" }
  | { kind: "series"; segments: Point[][]; mean: Point[]; last: Point; lo: number; hi: number };

function build(days: Day[]): Chart | null {
  const weighed = days
    .filter((d): d is Day & { weight: number } => d.weight != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (weighed.length === 0) return null;

  const t = (iso: string) => fromISO(iso).getTime();
  const minT = t(weighed[0].date);
  const maxT = t(weighed[weighed.length - 1].date);

  // Every reading on one date has no horizontal extent to plot against, so
  // there is no line to draw whatever the count says.
  if (weighed.length < 2 || maxT === minT) return { kind: "single" };

  const span = maxT - minT;
  const values = weighed.map((d) => d.weight);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // A flat fortnight should read as flat, not as noise magnified to fill the
  // box. The floor matters most when hi and lo are a few hundred grams apart.
  const pad = Math.max((hi - lo) * 0.25, 0.5);
  const top = hi + pad;
  const range = top - (lo - pad);

  const x = (iso: string) => ((t(iso) - minT) / span) * 100;
  const y = (w: number) => ((top - w) / range) * 100;

  // Seven-day trailing mean over the days actually recorded in that window,
  // rather than over the last seven rows, so a sparse stretch is not smoothed
  // against a dense one.
  const mean = weighed.map((d, i) => {
    const from = t(d.date) - 6 * 86400000;
    const window = weighed.slice(0, i + 1).filter((w) => t(w.date) >= from);
    return {
      x: x(d.date),
      y: y(window.reduce((sum, w) => sum + w.weight, 0) / window.length),
    };
  });

  // Break the raw series wherever a fortnight passes with nothing logged.
  const segments: Point[][] = [];
  let run: Point[] = [];
  weighed.forEach((d, i) => {
    const previous = weighed[i - 1];
    if (previous && t(d.date) - t(previous.date) > 14 * 86400000) {
      segments.push(run);
      run = [];
    }
    run.push({ x: x(d.date), y: y(d.weight) });
  });
  segments.push(run);

  return { kind: "series", segments, mean, last: mean[mean.length - 1], lo, hi };
}

function line(points: Point[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}
