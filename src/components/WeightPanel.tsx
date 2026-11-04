"use client";

import { useMemo, useState } from "react";
import { Day } from "@/lib/types";
import { fromISO, pastLabel } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { Range, WeightChart } from "./WeightChart";
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

    const first = weighed[weighed.length - 1].weight;
    return {
      latest,
      first,
      change: lastWeek.length > 0 ? mean(thisWeek) - mean(lastWeek) : null,
      average: mean(thisWeek),
      total: weighed.length > 1 ? mean(thisWeek) - first : null,
      count: weighed.length,
    };
  }, [days]);

  const store = useStore();
  const [range, setRange] = useState<Range>("all");
  /** The target weight, if one of their goals is tracked against it. */
  const target = useMemo(() => {
    const goal = store.goals.find((g) => g.status === "active" && g.tracker?.source === "weight");
    return goal?.tracker?.target ?? null;
  }, [store.goals]);

  return (
    <Panel className="px-5 py-5 sm:px-6">
      {stats ? (
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div>
            <p className="text-[12.5px] font-medium text-ink-3">{pastLabel(stats.latest.date)}</p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span className="nums text-[46px] font-bold leading-none tracking-tight">
                {stats.latest.weight.toFixed(1)}
              </span>
              <span className="text-[16px] font-medium text-ink-3">kg</span>
              {stats.change != null && (
                <span
                  className="nums ml-1 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold"
                  style={{
                    color: trendColor(stats.change),
                    background: `color-mix(in srgb, ${trendColor(stats.change)} 14%, transparent)`,
                  }}
                  title="7-day average against the week before"
                >
                  {stats.change < 0 ? "▼" : stats.change > 0 ? "▲" : "●"} {Math.abs(stats.change).toFixed(1)} kg / wk
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-7 gap-y-3">
            <Figure label="7-day average" value={stats.average.toFixed(1)} />
            {stats.total != null && (
              <Figure
                label="since first"
                value={`${stats.total > 0 ? "+" : ""}${stats.total.toFixed(1)}`}
                color={trendColor(stats.total)}
              />
            )}
            <Figure label={stats.count === 1 ? "weigh-in" : "weigh-ins"} value={String(stats.count)} />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[15px] font-semibold">No weigh-ins yet</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
            Log one below. Everything here compares a week against a week, so a heavy dinner
            never looks like progress lost.
          </p>
        </div>
      )}

      {stats && target != null && (
        <GoalBar start={stats.first} now={stats.average} target={target} rate={stats.change} />
      )}

      {stats && stats.count >= 2 && (
        <div className="mt-5 flex justify-end">
          <div className="flex gap-0.5 rounded-lg bg-panel-2 p-0.5">
            {(["1m", "3m", "all"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  range === r ? "bg-panel text-ink shadow-[var(--shadow)]" : "text-ink-3 hover:text-ink"
                }`}
              >
                {r === "all" ? "All" : r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2">
        <WeightChart days={days} range={range} target={target} height={280} />
      </div>
    </Panel>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="nums text-[22px] font-bold leading-none tracking-tight" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="mt-1 text-[11.5px] text-ink-3">{label}</p>
    </div>
  );
}

/**
 * How far along the way to the goal weight, and when you get there at this
 * rate — the number the whole page is about, said plainly.
 */
function GoalBar({ start, now, target, rate }: { start: number; now: number; target: number; rate: number | null }) {
  const total = start - target;
  const done = start - now;
  const share = total === 0 ? 1 : Math.max(0, Math.min(1, done / total));
  const left = Math.abs(now - target);
  const towards = rate != null && Math.abs(rate) >= 0.05 && Math.sign(rate) === Math.sign(target - now);
  const weeks = towards && rate ? Math.ceil(left / Math.abs(rate)) : null;
  const eta =
    weeks != null && weeks < 260
      ? new Date(Date.now() + weeks * 7 * 86_400_000).toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : null;

  return (
    <div className="mt-5 rounded-xl bg-panel-2/70 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
        <span className="font-semibold">
          Goal {target} kg <span className="font-normal text-ink-3">· {left.toFixed(1)} kg to go</span>
        </span>
        <span className="text-ink-3">
          {eta ? (
            <>
              At this pace: <span className="font-semibold text-ink-2">{eta}</span>
            </>
          ) : (
            "Not moving towards it this week"
          )}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-panel">
        <div
          className="grow-x h-full rounded-full"
          style={{ width: `${Math.max(share * 100, 2)}%`, background: "linear-gradient(90deg, var(--accent), var(--up))" }}
        />
      </div>
      <div className="nums mt-1 flex justify-between text-[11px] text-ink-3">
        <span>{start.toFixed(1)}</span>
        <span>{Math.round(share * 100)}%</span>
        <span>{target}</span>
      </div>
    </div>
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
