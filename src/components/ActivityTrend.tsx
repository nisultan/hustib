"use client";

import { useState } from "react";
import { Source, SOURCES, WeekBar } from "@/lib/activity";

/**
 * Week by week, stacked by where the work came from.
 *
 * Stacked rather than five separate lines, because the question is "was that a
 * good fortnight" first and "what was it made of" second — and five lines on
 * one pair of axes answers neither without a legend and a squint.
 *
 * The current week is drawn hatched. A bar that is short because it is Tuesday
 * looks exactly like a bar that is short because nothing happened, and the
 * only honest fix is to mark it as unfinished rather than to hide it.
 */
export function ActivityTrend({
  weeks,
  height = 120,
}: {
  weeks: WeekBar[];
  height?: number;
}) {
  const [hover, setHover] = useState<WeekBar | null>(null);

  const peak = Math.max(1, ...weeks.map((w) => w.total));
  const shown = hover ?? weeks[weeks.length - 1];


  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-ink-2">
          {shown ? (
            <>
              <span className="font-medium text-ink">
                {shown.total} {shown.total === 1 ? "thing" : "things"}
              </span>{" "}
              in the week of {shown.label}
              {shown.partial && <span className="text-ink-3"> · still running</span>}
            </>
          ) : (
            <span className="text-ink-3">Nothing logged yet.</span>
          )}
        </p>
        <p className="nums text-[10px] text-ink-3">peak {peak}</p>
      </div>

      {/*
        Bars grow to fill the width, but only up to a point. Uncapped `flex-1`
        meant a hub with three weeks of history drew three bars a third of the
        screen wide each — a chart that looks like a stretched flag rather than
        a trend. Capped, a short history reads as a short history.
      */}
      <div
        className="flex items-end gap-[3px]"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {weeks.map((week) => (
          <button
            key={week.start}
            type="button"
            title={`Week of ${week.label} — ${week.total}`}
            aria-label={`Week of ${week.label}: ${week.total} logged`}
            onMouseEnter={() => setHover(week)}
            onFocus={() => setHover(week)}
            style={{ maxWidth: 22 }}
            className="group flex h-full min-w-[4px] flex-1 flex-col justify-end rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {/*
              A floor of two pixels on any non-empty week. Rounding a quiet week
              down to nothing makes it indistinguishable from a week off, which
              is the one comparison this chart exists to support.
            */}
            <span
              className="flex w-full flex-col justify-end overflow-hidden rounded-[3px] transition-opacity group-hover:opacity-80"
              style={{
                height:
                  week.total === 0
                    ? 2
                    : Math.max(3, Math.round((week.total / peak) * height)),
                background: week.total === 0 ? "var(--panel-2)" : undefined,
                opacity: week.partial ? 0.55 : 1,
              }}
            >
              {week.total > 0 &&
                SOURCES.filter((s) => week.by[s.key] > 0).map((s) => (
                  <span
                    key={s.key}
                    style={{
                      flexGrow: week.by[s.key as Source],
                      background: s.color,
                    }}
                    className="w-full"
                  />
                ))}
            </span>
          </button>
        ))}
      </div>

      <Legend />
    </div>
  );
}

export function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {SOURCES.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ background: s.color }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}
