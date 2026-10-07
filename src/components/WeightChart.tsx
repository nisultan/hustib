"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Day } from "@/lib/types";
import { useStore } from "@/lib/store";
import { fromISO, formatDate } from "@/lib/dates";

/**
 * Weight over time.
 *
 * Three things the old one left out, each of which made it say less than it
 * looked like it was saying.
 *
 * It had no time axis, so two weigh-ins a fortnight apart drew the same long
 * confident slope as two years of work — a line falling steadily across the
 * whole panel, implying a continuous record of something that happened twice.
 * There are dates along the bottom now, and a dot on every actual reading, so
 * the gaps between them are visible as gaps.
 *
 * It drew the seven-day mean on top of the raw series from the second reading
 * onwards. With two points those are the same two points, so the pair fanned
 * out into a wedge that looked like a rendering fault. The mean now waits
 * until there is enough to average.
 *
 * And it never mentioned the target, which is the number the whole page is
 * about. If the goal sits inside the plotted range it is drawn as a line to
 * reach; if it is further off than the chart shows, it is said in words rather
 * than squashing a fortnight of real movement into a flat strip to fit.
 *
 * Laid out in real pixels rather than a stretched viewBox. The old one scaled
 * a 100×100 box to the panel, which turns every circle into an ellipse and
 * every label into a smear — workable while the only round thing was one
 * marker positioned in HTML, and not workable once there is a dot per reading.
 */

const PAD = { top: 10, right: 44, bottom: 20, left: 6 };
/** Below this, a seven-day mean is just the raw line with extra confidence. */
const MEAN_NEEDS = 4;

export function WeightChart({ days, height = 150 }: { days: Day[]; height?: number }) {
  const store = useStore();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Measured rather than assumed: the panel is a fraction of a grid column and
  // changes width with the sidebar, the viewport and the font size.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  /** The target weight, if one of their goals is being tracked against it. */
  const target = useMemo(() => {
    const goal = store.goals.find(
      (g) => g.status === "active" && g.tracker?.source === "weight",
    );
    return goal?.tracker?.target ?? null;
  }, [store.goals]);

  const data = useMemo(() => build(days), [days]);

  if (data == null) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-dashed border-line px-4 text-center text-xs text-ink-3"
        style={{ height }}
      >
        Log a weight to start the chart.
      </div>
    );
  }

  if (data.points.length < 2) {
    return (
      <div className="relative" style={{ height }}>
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-panel" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[11px] text-ink-3">
          One weigh-in so far — a second gives this a direction.
        </span>
      </div>
    );
  }

  const w = Math.max(width, 160);
  const plotW = w - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const { points, lo, hi, minT, maxT } = data;

  /*
    The target joins the scale only when it is close enough to share it. A goal
    of 95 against a fortnight spent between 109.7 and 111.9 would flatten two
    real kilograms into a hairline so that an unreachable-this-month line could
    be drawn — so beyond half the plotted range again, it is said in words.
  */
  const span = Math.max(hi - lo, 0.8);
  const inScale = target != null && target >= lo - span * 1.5 && target <= hi + span * 1.5;

  const low = Math.min(lo, inScale ? (target as number) : lo);
  const high = Math.max(hi, inScale ? (target as number) : hi);
  const pad = Math.max((high - low) * 0.18, 0.35);
  const top = high + pad;
  const bottom = low - pad;

  const X = (iso: string) =>
    PAD.left + ((fromISO(iso).getTime() - minT) / Math.max(maxT - minT, 1)) * plotW;
  const Y = (kg: number) => PAD.top + ((top - kg) / (top - bottom)) * plotH;

  const plotted = points.map((p) => ({ ...p, cx: X(p.date), cy: Y(p.weight) }));
  const meaned =
    points.length >= MEAN_NEEDS
      ? points.map((p) => ({ cx: X(p.date), cy: Y(p.mean) }))
      : null;

  // The line that carries the eye is whichever one is the honest reading: the
  // mean when there is one, the raw series when there is not.
  const spine = meaned ?? plotted.map((p) => ({ cx: p.cx, cy: p.cy }));
  const active = hover != null ? plotted[hover] : null;

  /** Three gridlines, at the top, middle and bottom of the plotted range. */
  const ticks = [top, (top + bottom) / 2, bottom];

  return (
    <div>
      <div
        ref={box}
        className="relative"
        style={{ height }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          let nearest = 0;
          for (let i = 1; i < plotted.length; i += 1) {
            if (Math.abs(plotted[i].cx - x) < Math.abs(plotted[nearest].cx - x)) nearest = i;
          }
          setHover(nearest);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          width={w}
          height={height}
          className="overflow-visible"
          aria-label={`Weight between ${lo.toFixed(1)} and ${hi.toFixed(1)} kilograms`}
        >
          <defs>
            <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((kg, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={w - PAD.right}
                y1={Y(kg)}
                y2={Y(kg)}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray={i === 1 ? "2 4" : undefined}
                opacity={i === 1 ? 0.7 : 1}
              />
              <text
                x={w - PAD.right + 6}
                y={Y(kg)}
                dominantBaseline="middle"
                className="nums"
                fontSize="10"
                fill="var(--text-3)"
              >
                {kg.toFixed(1)}
              </text>
            </g>
          ))}

          <path
            d={`${path(spine)} L${spine[spine.length - 1].cx} ${PAD.top + plotH} L${spine[0].cx} ${PAD.top + plotH} Z`}
            fill="url(#weight-fill)"
          />

          {/* The raw series, under the mean and only when the two differ. */}
          {meaned && (
            <path
              d={path(plotted.map((p) => ({ cx: p.cx, cy: p.cy })))}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity="0.28"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
          )}

          <path
            d={path(spine)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Every reading, so the gaps between them are visible as gaps. */}
          {plotted.map((p, i) => (
            <circle
              key={p.date}
              cx={p.cx}
              cy={p.cy}
              r={i === plotted.length - 1 ? 4 : hover === i ? 3.5 : 2.4}
              fill="var(--accent)"
              stroke="var(--panel)"
              strokeWidth={i === plotted.length - 1 || hover === i ? 2 : 1}
            />
          ))}

          {inScale && target != null && (
            <>
              <line
                x1={PAD.left}
                x2={w - PAD.right}
                y1={Y(target)}
                y2={Y(target)}
                stroke="var(--up)"
                strokeWidth="1.25"
                strokeDasharray="4 3"
              />
              <text
                x={w - PAD.right + 6}
                y={Y(target)}
                dominantBaseline="middle"
                className="nums"
                fontSize="10"
                fill="var(--up)"
              >
                goal
              </text>
            </>
          )}

          {active && (
            <line
              x1={active.cx}
              x2={active.cx}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--border-strong)"
              strokeWidth="1"
            />
          )}

          {/* First and last date only. A tick under every reading is a row of
              overlapping dates the moment there are more than five. */}
          <text x={PAD.left} y={height - 4} fontSize="10" fill="var(--text-3)">
            {formatDate(points[0].date)}
          </text>
          <text
            x={w - PAD.right}
            y={height - 4}
            textAnchor="end"
            fontSize="10"
            fill="var(--text-3)"
          >
            {formatDate(points[points.length - 1].date)}
          </text>
        </svg>

        {active && (
          <span
            className="nums pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-panel px-1.5 py-1 text-[10px] shadow-[var(--shadow-md)]"
            style={{
              left: Math.min(Math.max(active.cx, 44), w - PAD.right - 4),
              top: Math.max(active.cy - 34, 0),
            }}
          >
            <span className="font-semibold">{active.weight.toFixed(1)} kg</span>{" "}
            <span className="text-ink-3">{formatDate(active.date)}</span>
          </span>
        )}
      </div>

      {/* Said rather than drawn, when the goal is too far off to share a scale
          with a fortnight of real movement. */}
      {target != null && !inScale && (
        <p className="nums mt-1.5 text-[11px] text-ink-3">
          Goal {target} kg ·{" "}
          <span className="text-ink-2">
            {Math.abs(points[points.length - 1].weight - target).toFixed(1)} kg to go
          </span>
        </p>
      )}
    </div>
  );
}

interface Reading {
  date: string;
  weight: number;
  /** Trailing seven-day mean, by date rather than by row. */
  mean: number;
}

function build(
  days: Day[],
): { points: Reading[]; lo: number; hi: number; minT: number; maxT: number } | null {
  const weighed = days
    .filter((d): d is Day & { weight: number } => d.weight != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (weighed.length === 0) return null;

  const t = (iso: string) => fromISO(iso).getTime();

  const points: Reading[] = weighed.map((d, i) => {
    // Averaged over the days actually recorded in that window rather than over
    // the last seven rows, so a sparse stretch is not smoothed against a dense
    // one.
    const from = t(d.date) - 6 * 86_400_000;
    const window = weighed.slice(0, i + 1).filter((w) => t(w.date) >= from);
    return {
      date: d.date,
      weight: d.weight,
      mean: window.reduce((sum, w) => sum + w.weight, 0) / window.length,
    };
  });

  const values = points.map((p) => p.weight);
  return {
    points,
    lo: Math.min(...values),
    hi: Math.max(...values),
    minT: t(points[0].date),
    maxT: t(points[points.length - 1].date),
  };
}

function path(points: { cx: number; cy: number }[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.cx.toFixed(2)} ${p.cy.toFixed(2)}`)
    .join(" ");
}
