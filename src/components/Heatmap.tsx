"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DayActivity, SOURCES } from "@/lib/activity";
import { formatDate, todayISO } from "@/lib/dates";

/**
 * A year of days as a wall of squares.
 *
 * The chart everyone already knows how to read, which is most of why it is
 * worth having: nobody needs a legend explained to see that half of it is
 * dense and half is empty. What it adds over the month calendar is span — a
 * calendar shows you this month and cannot show you that you have been fading
 * since October.
 *
 * Time runs left to right, oldest to newest, the way every contribution graph
 * does. It was briefly reversed to put this week at the near edge; reading it
 * that way turns out to cost more than the scroll it saves, because every
 * instinct about a timeline says later is rightwards.
 *
 * The rest of the year is drawn rather than left off — dashed outlines for the
 * days that have not happened, filling in as they do. An empty grid that grows
 * a square a day is a different object from one that starts full of grey.
 *
 * Shades come from the accent at rising opacity rather than from five hand
 * picked colours, so the whole thing re-themes for free and stays legible on
 * both backgrounds. An empty day is a filled square, not a hole: a missing
 * square reads as "no data", and "nothing done" is data.
 */

/** Square size bounds and the gap between, in pixels. */
const MIN_CELL = 11;
const MAX_CELL = 22;
const GAP = 3;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
  const [hover, setHover] = useState<{ day: DayActivity; x: number; y: number } | null>(null);
  const today = todayISO();

  /*
    Squares grow to fill the panel: a year at 11px left half a wide screen
    empty. Bounded both ways — below 11 it is a smear, above 22 it is a
    bathroom floor. Under the minimum it scrolls, opening at today.
  */
  const strip = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const cell = width
    ? Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((width - GAP * (weeks.length - 1)) / Math.max(1, weeks.length))))
    : MIN_CELL;
  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length, cell]);

  // How often each weekday is an active one: which days carry you.
  const byWeekday = useMemo(() => {
    const active = Array(7).fill(0) as number[];
    const seen = Array(7).fill(0) as number[];
    for (const col of weeks)
      col.forEach((d, row) => {
        if (!d) return;
        seen[row] += 1;
        if (d.total > 0) active[row] += 1;
      });
    return active.map((a, i) => (seen[i] ? a / seen[i] : 0));
  }, [weeks]);
  const bestRow = byWeekday.indexOf(Math.max(...byWeekday));

  return (
    <div className="relative" data-heatmap>
      <div className="flex gap-2.5">
        {/* All seven days, outside the scroller so they never slide away. */}
        <div className="shrink-0" style={{ paddingTop: 20 }}>
          {WEEKDAYS.map((day, row) => (
            <div key={day} style={{ height: cell, marginBottom: GAP }} className="flex items-center">
              <span
                className={`w-8 text-right text-[10.5px] leading-none ${
                  row === bestRow && byWeekday[row] > 0 ? "font-semibold text-accent-text" : "text-ink-3"
                }`}
              >
                {day}
              </span>
            </div>
          ))}
        </div>

        <div ref={strip} className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
          <div className="inline-block">
            <div className="relative mb-1.5 h-[14px]">
              {months.map((month) => (
                <span
                  key={`${month.label}-${month.column}`}
                  style={{ left: month.column * (cell + GAP) }}
                  className="absolute top-0 border-l border-line pl-1 text-[10.5px] font-medium leading-none text-ink-3"
                >
                  {month.label}
                </span>
              ))}
            </div>

            <div className="flex" style={{ gap: GAP }}>
              {weeks.map((column, w) => (
                <div
                  key={w}
                  className="dot-in flex flex-col"
                  style={{ gap: GAP, ["--d" as string]: `${Math.min(w * 12, 600)}ms` }}
                >
                  {column.map((day, row) =>
                    day == null ? (
                      <span
                        key={row}
                        aria-hidden
                        style={{ width: cell, height: cell }}
                        className="rounded-[3px] border border-dashed border-line opacity-60"
                      />
                    ) : (
                      <Square
                        key={day.date}
                        day={day}
                        size={cell}
                        isToday={day.date === today}
                        onHover={(d, el) => {
                          if (!d || !el) return setHover(null);
                          const box = el.getBoundingClientRect();
                          const host = el.closest("[data-heatmap]")?.getBoundingClientRect();
                          const x = box.left - (host?.left ?? 0) + box.width / 2;
                          setHover({ day: d, x: Math.max(90, Math.min(x, (host?.width ?? 0) - 90)), y: box.top - (host?.top ?? 0) });
                        }}
                        onPick={onPick}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Per-weekday rhythm: share of each weekday you were active. */}
        <div className="hidden shrink-0 sm:block" style={{ paddingTop: 20 }}>
          {byWeekday.map((share, row) => (
            <div key={row} style={{ height: cell, marginBottom: GAP }} className="flex items-center gap-1.5">
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-panel-2">
                <span
                  className="grow-x block h-full rounded-full"
                  style={{
                    width: `${Math.max(share * 100, share > 0 ? 6 : 0)}%`,
                    background: row === bestRow ? "var(--accent)" : "color-mix(in srgb, var(--accent) 55%, var(--panel-2))",
                  }}
                />
              </span>
              <span className="nums w-7 text-[10.5px] text-ink-3">{Math.round(share * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating readout over the hovered square. */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] shadow-lg"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <span className="font-semibold">
            {hover.day.total === 0 ? "Nothing logged" : `${hover.day.total} ${hover.day.total === 1 ? "thing" : "things"}`}
          </span>{" "}
          <span className="text-ink-3">· {formatDate(hover.day.date)}</span>
          {hover.day.total > 0 && <div className="mt-0.5 text-[11px] text-ink-2">{breakdown(hover.day)}</div>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-ink-3">
          {byWeekday[bestRow] > 0 ? (
            <>
              Strongest on <span className="font-semibold text-ink-2">{WEEKDAY_FULL[bestRow]}s</span> — active{" "}
              {Math.round(byWeekday[bestRow] * 100)}% of them. Tap a square to open the day.
            </>
          ) : (
            "Tap a square to open the day."
          )}
        </p>

        <div className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              aria-hidden
              style={{ width: 11, height: 11, background: fill(level) }}
              className="rounded-[3px] ring-1 ring-inset ring-line/60"
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
  size,
  isToday,
  onHover,
  onPick,
}: {
  day: DayActivity;
  size: number;
  isToday: boolean;
  onHover: (day: DayActivity | null, el: HTMLElement | null) => void;
  onPick?: (date: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${formatDate(day.date)}, ${day.total} logged`}
      onMouseEnter={(e) => onHover(day, e.currentTarget)}
      onMouseLeave={() => onHover(null, null)}
      onFocus={(e) => onHover(day, e.currentTarget)}
      onBlur={() => onHover(null, null)}
      onClick={() => onPick?.(day.date)}
      style={{ width: size, height: size, background: fill(day.level) }}
      className={`rounded-[3px] ring-1 ring-inset ring-line/60 transition-transform hover:z-10 hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        isToday ? "outline outline-2 outline-offset-1 outline-[var(--accent)]" : ""
      }`}
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
