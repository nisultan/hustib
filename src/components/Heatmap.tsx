"use client";

import { useState } from "react";
import { DayActivity, SOURCES } from "@/lib/activity";
import { formatDate } from "@/lib/dates";

/**
 * A year of days as a wall of squares.
 *
 * The chart everyone already knows how to read, which is most of why it is
 * worth having: nobody needs a legend explained to see that half of it is
 * dense and half is empty. What it adds over the month calendar is span — a
 * calendar shows you this month and cannot show you that you have been fading
 * since October.
 *
 * Time runs right to left here: the newest week is the leftmost column. That
 * inverts every contribution graph ever drawn, and it is the ask — this one is
 * read for "how am I doing lately", and the usual order buries that answer at
 * the far end of a strip you have to scroll first.
 *
 * Shades come from the accent at rising opacity rather than from five hand
 * picked colours, so the whole thing re-themes for free and stays legible on
 * both backgrounds. An empty day is a filled square, not a hole: a missing
 * square reads as "no data", and "nothing done" is data.
 */

/** Square edge and the gap between, in pixels. Small enough that a year fits. */
const CELL = 11;
const GAP = 3;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Heatmap({
  weeks,
  months,
  onPick,
}: {
  weeks: (DayActivity | null)[][];
  months: { label: string; column: number }[];
  /** Opens the day. A wall chart you cannot click is a poster. */
  onPick?: (date: string) => void;
}) {
  const [hover, setHover] = useState<DayActivity | null>(null);

  return (
    <div>
      {/*
        Scrolled rather than squeezed. Fifty-three columns will not fit a phone
        at a legible square size, and the alternative — shrinking the squares
        until they do — produces a grey smear that answers no question at all.
        The newest week is the first column now, so it starts where any strip
        starts and the recent weeks are simply there.
      */}
      <div className="flex gap-2">
        {/* Outside the scroller on purpose. Inside it, the labels slide off the
            left edge the moment the grid is scrolled — which on a phone it
            always is, because it opens at the most recent week. */}
        <div className="shrink-0 pt-[19px]">
          {WEEKDAYS.map((day, row) => (
            <div
              key={day}
              style={{ height: CELL, marginBottom: GAP }}
              className="flex items-center"
            >
              {/* Every other label: seven stacked at this size is a column of
                  grey noise beside the thing you are meant to look at. */}
              <span className="w-7 pr-1 text-right text-[9px] leading-none text-ink-3">
                {row % 2 === 1 ? day : ""}
              </span>
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
          <div className="inline-block">
            <div className="relative mb-1 h-[14px]">
              {months.map((month) => (
                <span
                  key={`${month.label}-${month.column}`}
                  style={{ left: month.column * (CELL + GAP) }}
                  className="absolute top-0 text-[10px] leading-none text-ink-3"
                >
                  {month.label}
                </span>
              ))}
            </div>

            <div className="flex" style={{ gap: GAP }}>
              {weeks.map((column, w) => (
                <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                  {column.map((day, row) =>
                    day == null ? (
                      <span key={row} style={{ width: CELL, height: CELL }} />
                    ) : (
                      <Square key={day.date} day={day} onHover={setHover} onPick={onPick} />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {/*
          The readout is a fixed line under the grid rather than a tooltip that
          follows the cursor. A floating bubble over a grid this dense covers
          the squares either side of the one being read, and on a touch screen
          there is no hover to show it with at all.
        */}
        <p className="min-h-[16px] text-xs text-ink-2">
          {hover ? (
            <>
              <span className="font-medium text-ink">
                {hover.total === 0
                  ? "Nothing logged"
                  : `${hover.total} ${hover.total === 1 ? "thing" : "things"}`}
              </span>{" "}
              on {formatDate(hover.date)}
              {hover.total > 0 && <span className="text-ink-3"> · {breakdown(hover)}</span>}
            </>
          ) : (
            <span className="text-ink-3">
              Hover a square for the day it stands for. Newest week on the left.
            </span>
          )}
        </p>

        <div className="flex items-center gap-1.5 text-[10px] text-ink-3">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              aria-hidden
              style={{ width: CELL, height: CELL, background: fill(level) }}
              className="rounded-[2px] ring-1 ring-inset ring-line/60"
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function Square({
  day,
  onHover,
  onPick,
}: {
  day: DayActivity;
  onHover: (day: DayActivity | null) => void;
  onPick?: (date: string) => void;
}) {
  return (
    <button
      type="button"
      // The native tooltip as well as the readout: it is the only version that
      // survives the page being printed to PDF or read with the mouse alone.
      title={`${formatDate(day.date)} — ${day.total === 0 ? "nothing logged" : breakdown(day)}`}
      aria-label={`${formatDate(day.date)}, ${day.total} logged`}
      onMouseEnter={() => onHover(day)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(day)}
      onBlur={() => onHover(null)}
      onClick={() => onPick?.(day.date)}
      style={{ width: CELL, height: CELL, background: fill(day.level) }}
      className="rounded-[2px] ring-1 ring-inset ring-line/60 transition-[outline] hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-ink-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    />
  );
}

/** Empty days sit on the panel's own quiet fill; the rest climb the accent. */
function fill(level: number): string {
  if (level <= 0) return "var(--panel-2)";
  const opacity = [0, 0.3, 0.5, 0.72, 1][Math.min(4, level)];
  return `color-mix(in srgb, var(--accent) ${opacity * 100}%, var(--panel-2))`;
}

/** "3 tasks · 1 block" — what the square was actually made of. */
function breakdown(day: DayActivity): string {
  return SOURCES.filter((s) => day.by[s.key] > 0)
    .map((s) => {
      const count = day.by[s.key];
      // Every source label is either already singular or a plain plural, so
      // dropping the "s" is enough. "1 weigh-ins" is the kind of detail that
      // makes a number look auto-generated and therefore not worth reading.
      const word = s.label.toLowerCase();
      return `${count} ${count === 1 ? word.replace(/s$/, "") : word}`;
    })
    .join(" · ");
}
