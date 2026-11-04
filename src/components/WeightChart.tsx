"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Day } from "@/lib/types";
import { fromISO, formatDate } from "@/lib/dates";

/**
 * Weight over time — the trend, drawn so you can feel it move.
 *
 *  - Real time on the x-axis (gaps between weigh-ins stay gaps) with a date
 *    under each week or month, not just the two ends.
 *  - The seven-day mean is the main line, smoothed into a curve, and it draws
 *    itself in on load and whenever the range changes; the area beneath
 *    sweeps up after it. Raw readings sit underneath as dots.
 *  - A dashed projection continues the current rate (a least-squares fit over
 *    the last few weeks) two weeks forward, so "where is this heading" is on
 *    the chart rather than a sum you do in your head.
 *  - Hover or drag anywhere: a crosshair snaps to the nearest weigh-in and a
 *    card says the weight, the change since the reading before, and the mean.
 *  - 1M / 3M / All, because a year of data squeezes last week into a pixel.
 *
 * Laid out in real pixels (measured width), not a stretched viewBox, so dots
 * stay round and labels stay crisp.
 */

const PAD = { top: 16, right: 48, bottom: 26, left: 8 };
const MEAN_NEEDS = 4;
const DAY = 86_400_000;

export type Range = "1m" | "3m" | "all";

export function WeightChart({
  days,
  height = 260,
  range = "all",
  target = null,
}: {
  days: Day[];
  height?: number;
  range?: Range;
  target?: number | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const all = useMemo(() => build(days), [days]);
  const data = useMemo(() => {
    if (!all) return null;
    if (range === "all") return all;
    const cut = all[all.length - 1].t - (range === "1m" ? 31 : 92) * DAY;
    const sliced = all.filter((p) => p.t >= cut);
    return sliced.length >= 2 ? sliced : all.slice(-2);
  }, [all, range]);

  if (data == null) {
    return (
      <div ref={box} className="grid place-items-center rounded-xl border border-dashed border-line px-4 text-center text-[13px] text-ink-3" style={{ height }}>
        Log a weight to start the chart.
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div ref={box} className="relative grid place-items-center" style={{ height }}>
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        <span className="relative size-3 rounded-full bg-accent ring-4 ring-accent/20" />
        <span className="absolute inset-x-0 bottom-2 text-center text-[12px] text-ink-3">
          One weigh-in so far — a second gives this a direction.
        </span>
      </div>
    );
  }

  const w = Math.max(width, 200);
  const plotW = w - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  // Projection: least squares over the last 28 days of readings (at least 3).
  const recent = data.filter((p) => p.t >= data[data.length - 1].t - 28 * DAY);
  const fit = recent.length >= 3 ? regress(recent) : null;
  const projDays = 14;
  const last = data[data.length - 1];
  const projEnd = fit ? { t: last.t + projDays * DAY, kg: last.mean + fit.slope * projDays * DAY } : null;

  const minT = data[0].t;
  const maxT = projEnd ? projEnd.t : last.t;

  const values = data.map((p) => p.weight).concat(projEnd ? [projEnd.kg] : []);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = Math.max(hi - lo, 0.8);
  const inScale = target != null && target >= lo - span * 1.2 && target <= hi + span * 1.2;
  if (inScale) {
    lo = Math.min(lo, target as number);
    hi = Math.max(hi, target as number);
  }
  const pad = Math.max((hi - lo) * 0.15, 0.4);
  const top = hi + pad;
  const bottom = lo - pad;

  const X = (t: number) => PAD.left + ((t - minT) / Math.max(maxT - minT, 1)) * plotW;
  const Y = (kg: number) => PAD.top + ((top - kg) / (top - bottom)) * plotH;

  const pts = data.map((p) => ({ ...p, cx: X(p.t), cy: Y(p.weight), my: Y(p.mean) }));
  const useMean = data.length >= MEAN_NEEDS;
  const spine = pts.map((p) => ({ x: p.cx, y: useMean ? p.my : p.cy }));
  const spinePath = smooth(spine);
  const floor = PAD.top + plotH;
  const areaPath = `${spinePath} L${spine[spine.length - 1].x} ${floor} L${spine[0].x} ${floor} Z`;

  const active = hover != null ? pts[hover] : null;
  const before = hover != null && hover > 0 ? pts[hover - 1] : null;

  const ticksY = niceTicks(bottom, top, 4);
  const ticksX = dateTicks(minT, maxT, plotW);

  // Colour the trend by direction: falling is good on this page.
  const delta = useMean ? last.mean - pts[0].mean : last.weight - pts[0].weight;
  const tone = Math.abs(delta) < 0.1 ? "var(--accent)" : delta < 0 ? "var(--up)" : "var(--high)";

  const animKey = `${range}-${data.length}-${Math.round(w / 50)}`;

  return (
    <div
      ref={box}
      className="relative touch-none select-none"
      style={{ height }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let nearest = 0;
        for (let i = 1; i < pts.length; i += 1) {
          if (Math.abs(pts[i].cx - x) < Math.abs(pts[nearest].cx - x)) nearest = i;
        }
        setHover(nearest);
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={w} height={height} className="overflow-visible" aria-label="Weight over time">
        <defs>
          <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.32" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
          <filter id="wglow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {ticksY.map((kg) => (
          <g key={kg}>
            <line x1={PAD.left} x2={w - PAD.right} y1={Y(kg)} y2={Y(kg)} stroke="var(--border)" strokeDasharray="2 5" />
            <text x={w - PAD.right + 8} y={Y(kg)} dominantBaseline="middle" className="nums" fontSize="11" fill="var(--text-3)">
              {kg.toFixed(kg % 1 === 0 ? 0 : 1)}
            </text>
          </g>
        ))}

        {ticksX.map((t) => (
          <text key={t} x={X(t)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--text-3)">
            {formatDate(new Date(t).toISOString().slice(0, 10))}
          </text>
        ))}

        {inScale && target != null && (
          <g>
            <line x1={PAD.left} x2={w - PAD.right} y1={Y(target)} y2={Y(target)} stroke="var(--up)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.8" />
            <rect x={w - PAD.right + 3} y={Y(target) - 9} width={40} height={18} rx={5} fill="color-mix(in srgb, var(--up) 18%, transparent)" />
            <text x={w - PAD.right + 23} y={Y(target)} textAnchor="middle" dominantBaseline="middle" className="nums" fontSize="10.5" fontWeight="600" fill="var(--up)">
              {target}
            </text>
          </g>
        )}

        <g key={animKey}>
          <path d={areaPath} fill="url(#wfill)" className="reveal-up" style={{ ["--d" as string]: "350ms" }} />

          {useMean && (
            <path
              d={smooth(pts.map((p) => ({ x: p.cx, y: p.cy })))}
              fill="none"
              stroke={tone}
              strokeOpacity="0.25"
              strokeWidth="1.25"
            />
          )}

          {/* Glow under the trend, then the trend itself — both drawing in. */}
          <path d={spinePath} fill="none" stroke={tone} strokeWidth="6" opacity="0.35" filter="url(#wglow)" pathLength={1} className="draw" />
          <path d={spinePath} fill="none" stroke={tone} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw" />

          {projEnd && (
            <g className="fade-in-late">
              <path
                d={`M${spine[spine.length - 1].x} ${spine[spine.length - 1].y} L${X(projEnd.t)} ${Y(projEnd.kg)}`}
                fill="none"
                stroke={tone}
                strokeWidth="2"
                strokeDasharray="3 5"
                strokeLinecap="round"
                opacity="0.7"
              />
              <circle cx={X(projEnd.t)} cy={Y(projEnd.kg)} r="3.5" fill="var(--panel)" stroke={tone} strokeWidth="1.75" />
              <text x={X(projEnd.t)} y={Y(projEnd.kg) - 10} textAnchor="end" className="nums" fontSize="10.5" fill="var(--text-3)">
                ~{projEnd.kg.toFixed(1)} in 2 wks
              </text>
            </g>
          )}

          {pts.map((p, i) => (
            <circle
              key={p.date}
              cx={p.cx}
              cy={p.cy}
              r={hover === i ? 5 : 2.6}
              fill={hover === i ? tone : "var(--panel)"}
              stroke={tone}
              strokeWidth={1.75}
              className="dot-in"
              style={{ ["--d" as string]: `${200 + (i / pts.length) * 900}ms`, transition: "r 120ms" }}
            />
          ))}
        </g>

        {/* Latest reading, pulsing. */}
        <g>
          <circle cx={pts[pts.length - 1].cx} cy={pts[pts.length - 1].cy} r="10" fill={tone} className="ping" />
          <circle cx={pts[pts.length - 1].cx} cy={pts[pts.length - 1].cy} r="5" fill={tone} stroke="var(--panel)" strokeWidth="2" />
        </g>

        {active && (
          <line x1={active.cx} x2={active.cx} y1={PAD.top} y2={floor} stroke="var(--border-strong)" strokeDasharray="3 3" />
        )}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-10 min-w-[132px] -translate-x-1/2 rounded-xl border border-line bg-panel px-3 py-2 shadow-[var(--shadow-lg)]"
          style={{
            left: Math.min(Math.max(active.cx, 70), w - PAD.right - 66),
            top: Math.max(active.cy - 92, 0),
          }}
        >
          <p className="text-[11px] text-ink-3">{formatDate(active.date)}</p>
          <p className="nums text-[18px] font-bold leading-tight">
            {active.weight.toFixed(1)} <span className="text-[12px] font-medium text-ink-3">kg</span>
          </p>
          <div className="nums mt-0.5 flex gap-2 text-[11px]">
            {before && (
              <span style={{ color: changeColor(active.weight - before.weight) }}>
                {active.weight - before.weight > 0 ? "+" : ""}
                {(active.weight - before.weight).toFixed(1)}
              </span>
            )}
            {useMean && <span className="text-ink-3">avg {active.mean.toFixed(1)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function changeColor(d: number): string {
  if (Math.abs(d) < 0.05) return "var(--text-3)";
  return d < 0 ? "var(--up)" : "var(--high)";
}

interface Reading {
  date: string;
  t: number;
  weight: number;
  /** Trailing seven-day mean, by date rather than by row. */
  mean: number;
}

export function build(days: Day[]): Reading[] | null {
  const weighed = days
    .filter((d): d is Day & { weight: number } => d.weight != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (weighed.length === 0) return null;
  const t = (iso: string) => fromISO(iso).getTime();
  return weighed.map((d, i) => {
    const from = t(d.date) - 6 * DAY;
    const win = weighed.slice(0, i + 1).filter((w) => t(w.date) >= from);
    return { date: d.date, t: t(d.date), weight: d.weight, mean: win.reduce((s, w) => s + w.weight, 0) / win.length };
  });
}

/** Least-squares slope (kg per ms) over the readings. */
export function regress(points: { t: number; weight: number }[]): { slope: number } {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.t, 0) / n;
  const my = points.reduce((s, p) => s + p.weight, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mx) * (p.weight - my);
    den += (p.t - mx) ** 2;
  }
  return { slope: den === 0 ? 0 : num / den };
}

/** Monotone cubic curve through the points — smooth without overshooting. */
function smooth(p: { x: number; y: number }[]): string {
  if (p.length < 3) return p.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ");
  const n = p.length;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i += 1) d.push((p[i + 1].y - p[i].y) / Math.max(p[i + 1].x - p[i].x, 0.001));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i += 1) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  let s = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = (p[i + 1].x - p[i].x) / 3;
    s += ` C${(p[i].x + h).toFixed(1)} ${(p[i].y + m[i] * h).toFixed(1)} ${(p[i + 1].x - h).toFixed(1)} ${(p[i + 1].y - m[i + 1] * h).toFixed(1)} ${p[i + 1].x.toFixed(1)} ${p[i + 1].y.toFixed(1)}`;
  }
  return s;
}

function niceTicks(lo: number, hi: number, count: number): number[] {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Date labels roughly every 90px, snapped to whole days. */
function dateTicks(minT: number, maxT: number, plotW: number): number[] {
  const n = Math.max(2, Math.min(7, Math.floor(plotW / 90)));
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = minT + ((maxT - minT) * i) / (n - 1);
    out.push(Math.round(t / DAY) * DAY);
  }
  return [...new Set(out)];
}
