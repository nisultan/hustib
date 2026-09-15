"use client";

import { useMemo, useState } from "react";
import { Day } from "@/lib/types";
import { fromISO, pastLabel } from "@/lib/dates";
import { WeightChart } from "./WeightChart";
import { Panel } from "./ui";

/**
 * Where the weight stands, and where it is heading.
 *
 * Every number here is a mean over a week rather than a reading from one
 * morning. Bodyweight moves the better part of a kilo on salt, sleep and
 * timing alone, so a panel that headlines "yesterday vs today" reports noise
 * as progress — and progress lost, about half the time.
 */
export function WeightSummary({ days }: { days: Day[] }) {
  const stats = useMemo(() => {
    const weighed = days
      .filter((d): d is Day & { weight: number } => d.weight != null)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    if (weighed.length === 0) return null;

    const latest = weighed[0];
    const mean = (list: typeof weighed) =>
      list.reduce((sum, d) => sum + d.weight, 0) / list.length;

    const t = (iso: string) => fromISO(iso).getTime();
    const now = t(latest.date);
    const thisWeek = weighed.filter((d) => t(d.date) > now - 7 * 86400000);
    const lastWeek = weighed.filter(
      (d) => t(d.date) <= now - 7 * 86400000 && t(d.date) > now - 14 * 86400000,
    );

    return {
      latest,
      change: lastWeek.length > 0 ? mean(thisWeek) - mean(lastWeek) : null,
      average: mean(thisWeek),
      count: weighed.length,
    };
  }, [days]);

  return (
    <Panel className="grid gap-5 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:items-center">
      <div>
        {stats ? (
          <>
            <p className="flex items-baseline gap-1.5">
              <span className="nums text-3xl font-semibold tracking-tight">
                {stats.latest.weight.toFixed(1)}
              </span>
              <span className="text-sm text-ink-2">kg</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-3">{pastLabel(stats.latest.date)}</p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {stats.change != null && (
                <span className="flex items-center gap-1">
                  <span
                    className="nums font-medium"
                    style={{ color: trendColor(stats.change) }}
                  >
                    {stats.change > 0 ? "+" : ""}
                    {stats.change.toFixed(2)} kg
                  </span>
                  <span className="text-ink-3">vs last week</span>
                </span>
              )}
              <span className="text-ink-3">
                <span className="nums font-medium text-ink-2">{stats.average.toFixed(1)}</span>{" "}
                7-day average
              </span>
              <span className="nums text-ink-3">
                {stats.count} {stats.count === 1 ? "weigh-in" : "weigh-ins"}
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">No weigh-ins yet</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              Log one below. Everything here compares a week against a week, so a heavy dinner
              never looks like progress lost.
            </p>
          </>
        )}
      </div>

      <WeightChart days={days} />
    </Panel>
  );
}

/** Down is green here. This is the one chart in the app where that is true. */
export function trendColor(delta: number): string {
  if (Math.abs(delta) < 0.1) return "var(--flat)";
  return delta < 0 ? "var(--up)" : "var(--high)";
}

/**
 * The weigh-in.
 *
 * Text rather than `type="number"`, so a stray scroll over the field cannot
 * silently rewrite a recorded weight, and so a comma works for anyone whose
 * scale or keyboard uses one.
 */
export function WeightInput({
  value,
  onChange,
  label = "Weight",
  autoFocus,
}: {
  value: number | null;
  onChange: (weight: number | null) => void;
  label?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);

  // Follows the day being viewed, unless the field is mid-edit.
  const shown = dirty ? text : value == null ? "" : String(value);

  const commit = () => {
    setDirty(false);
    const raw = shown.trim().replace(",", ".");
    if (raw === "") {
      onChange(null);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n >= 700) {
      setText("");
      return;
    }
    onChange(Math.round(n * 10) / 10);
  };

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      <span className="relative inline-block">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={shown}
          placeholder="72.4"
          onChange={(e) => {
            setDirty(true);
            setText(e.target.value);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="nums w-32 rounded-lg border border-line bg-panel-2 py-2 pl-3 pr-9 text-sm text-ink placeholder:text-ink-3 transition-[background-color,border-color,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:bg-panel focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">
          kg
        </span>
      </span>
    </label>
  );
}

/**
 * One tap for the weights either side of the last one.
 *
 * Bodyweight moves in tenths, and retyping four characters every morning to
 * change one digit is the kind of friction that ends a logging habit.
 */
export function QuickWeights({
  anchor,
  current,
  onPick,
}: {
  /** The weight to offer neighbours of — usually the most recent one. */
  anchor: number | null;
  current: number | null;
  onPick: (weight: number) => void;
}) {
  if (anchor == null) return null;

  const options = [-0.4, -0.2, 0, 0.2, 0.4].map((d) => Math.round((anchor + d) * 10) / 10);

  return (
    <div className="flex flex-wrap gap-1">
      {options.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onPick(w)}
          className={`nums rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
            w === current
              ? "border-accent bg-accent-soft text-accent-text"
              : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
          }`}
        >
          {w.toFixed(1)}
        </button>
      ))}
    </div>
  );
}
