"use client";

import { useMemo, useState } from "react";
import { Source, SOURCES, WeekBar } from "@/lib/activity";

/**
 * Week by week, stacked by where the work came from.
 *
 * The first version drew all 52 weeks of the year at a fixed bar width, so a
 * hub with two months of history was a long empty floor with a few thin bars
 * crammed into the right-hand corner — technically a chart, practically a
 * blank box. Now:
 *
 *  - The axis starts where the history does (with at least twelve weeks, so a
 *    short history still reads as a trend and not three giant blocks), and the
 *    bars widen to fill it.
 *  - The headline is a number you can feel: this week (or the hovered one),
 *    how it compares with the week before, and where it sits against your
 *    average and your best — both drawn on the chart as reference lines.
 *  - Hovering a week breaks it down by source, with counts, instead of making
 *    you match colours against a legend.
 *  - The week still running is hatched rather than faded, and gets a projected
 *    outline of where it is heading at the current pace.
 */
export function ActivityTrend({ weeks: all, height = 150 }: { weeks: WeekBar[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);

  const weeks = useMemo(() => {
    const first = all.findIndex((w) => w.total > 0);
    if (first === -1) return all.slice(-12);
    return all.slice(Math.max(0, Math.min(first, all.length - 12)));
  }, [all]);

  const stats = useMemo(() => {
    const full = weeks.filter((w) => !w.partial && w.total > 0);
    const avg = full.length ? full.reduce((s, w) => s + w.total, 0) / full.length : null;
    const best = weeks.reduce<WeekBar | null>((b, w) => (!b || w.total > b.total ? w : b), null);
    const current = weeks[weeks.length - 1];
    // A fair projection for the running week: what it has so far, scaled to
    // seven days. Only shown once there is something to scale.
    let projected: number | null = null;
    if (current?.partial && current.total > 0) {
      const dayOfWeek = ((new Date().getDay() + 6) % 7) + 1; // Mon = 1
      projected = Math.round((current.total / dayOfWeek) * 7);
    }
    return { avg, best, projected };
  }, [weeks]);

  const peak = Math.max(1, ...weeks.map((w) => w.total), stats.projected ?? 0);
  const shownIndex = hover ?? weeks.length - 1;
  const shown = weeks[shownIndex];
  const previous = weeks[shownIndex - 1];

  const delta =
    shown && previous && previous.total > 0
      ? Math.round(((shown.total - previous.total) / previous.total) * 100)
      : null;

  // Month labels under the first week of each month, spaced so they never collide.
  const ticks = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    let last = "";
    weeks.forEach((w, i) => {
      const month = w.label.split(" ")[0];
      if (month !== last && (out.length === 0 || i - out[out.length - 1].i >= 3)) out.push({ i, label: month });
      last = month;
    });
    return out;
  }, [weeks]);

  const y = (v: number) => Math.round((v / peak) * height);

  return (
    <div>
      {/* Headline */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-ink-3">
            {shown ? (
              <>
                {hover == null ? (shown.partial ? "This week" : `Week of ${shown.label}`) : `Week of ${shown.label}`}
                {shown.partial && <span> · still running</span>}
              </>
            ) : (
              "Nothing logged yet"
            )}
          </p>
          <div className="mt-0.5 flex items-baseline gap-2.5">
            <span className="nums text-[34px] font-bold leading-none tracking-tight">{shown?.total ?? 0}</span>
            <span className="text-[13px] text-ink-3">{shown?.total === 1 ? "thing done" : "things done"}</span>
            {delta != null && (
              <span
                className="nums rounded-full px-2 py-0.5 text-[12px] font-semibold"
                style={{
                  color: delta >= 0 ? "var(--up)" : "var(--urgent)",
                  background: `color-mix(in srgb, ${delta >= 0 ? "var(--up)" : "var(--urgent)"} 13%, transparent)`,
                }}
                title="Compared with the week before"
              >
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
              </span>
            )}
          </div>
          {shown?.partial && stats.projected != null && hover == null && (
            <p className="mt-1.5 text-[12px] text-ink-3">
              On pace for <span className="nums font-semibold text-ink-2">{stats.projected}</span>
              {stats.avg != null && (
                <>
                  {" — "}
                  {stats.projected >= stats.avg ? (
                    <span style={{ color: "var(--up)" }}>above your average</span>
                  ) : (
                    <span>{Math.ceil(stats.avg - (shown.total ?? 0))} more to reach your average</span>
                  )}
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex gap-5">
          <Stat label="weekly avg" value={stats.avg == null ? "—" : String(Math.round(stats.avg))} />
          <Stat label={stats.best ? `best · ${stats.best.label}` : "best"} value={String(stats.best?.total ?? 0)} />
        </div>
      </div>

      {/* Breakdown of the shown week — replaces matching colours against a legend. */}
      <div className="mb-3 flex min-h-[26px] flex-wrap gap-1.5">
        {SOURCES.map((s) => {
          const n = shown?.by[s.key as Source] ?? 0;
          return (
            <span
              key={s.key}
              className={`nums flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11.5px] transition-opacity ${
                n === 0 ? "opacity-40" : ""
              }`}
            >
              <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
              <span className="text-ink-3">{s.label}</span>
              <span className="font-semibold text-ink">{n}</span>
            </span>
          );
        })}
      </div>

      {/* Chart */}
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        {stats.avg != null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-[var(--text-3)] opacity-50"
            style={{ bottom: y(stats.avg) }}
          >
            <span className="nums absolute -top-[9px] right-0 rounded bg-panel px-1 text-[10px] text-ink-3">
              avg {Math.round(stats.avg)}
            </span>
          </div>
        )}

        <div className="flex h-full items-end gap-[5px]">
          {weeks.map((week, i) => {
            const active = i === shownIndex;
            const dim = hover != null && !active;
            const h = week.total === 0 ? 3 : Math.max(5, y(week.total));
            const isBest = stats.best === week && week.total > 0;
            return (
              <button
                key={week.start}
                type="button"
                aria-label={`Week of ${week.label}: ${week.total} done`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="relative flex h-full min-w-[6px] flex-1 flex-col items-center justify-end rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                style={{ maxWidth: 44 }}
              >
                {isBest && (
                  <span aria-hidden className="mb-1 text-[11px] leading-none" style={{ color: "var(--high)" }} title="Best week">
                    ★
                  </span>
                )}
                {/* Projection outline for the running week. */}
                {week.partial && stats.projected != null && stats.projected > week.total && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 w-full rounded-md border border-dashed border-[var(--text-3)] opacity-60"
                    style={{ height: y(stats.projected) }}
                  />
                )}
                <span
                  className="bar-grow relative flex w-full flex-col-reverse overflow-hidden rounded-md transition-[opacity,filter] duration-150"
                  style={{
                    height: h,
                    background: week.total === 0 ? "var(--panel-2)" : undefined,
                    opacity: dim ? 0.35 : 1,
                    filter: active && hover != null ? "brightness(1.1)" : undefined,
                    animationDelay: `${Math.min(i * 18, 400)}ms`,
                  }}
                >
                  {week.total > 0 &&
                    SOURCES.filter((s) => week.by[s.key] > 0).map((s) => (
                      <span key={s.key} className="w-full" style={{ flexGrow: week.by[s.key as Source], background: s.color }} />
                    ))}
                  {week.partial && week.total > 0 && (
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg, rgba(0,0,0,0.28) 0 3px, transparent 3px 7px)",
                      }}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Month axis */}
      <div className="relative mt-2 h-4 border-t border-line">
        {ticks.map((t) => (
          <span
            key={t.i}
            className="absolute top-1 text-[10.5px] text-ink-3"
            style={{ left: `${(t.i / weeks.length) * 100}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="nums text-[20px] font-bold leading-none tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

export function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {SOURCES.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <span aria-hidden className="size-2 rounded-[2px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
