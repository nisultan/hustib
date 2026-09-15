"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, formatDate, fromISO, pastLabel, todayISO } from "@/lib/dates";
import { Block, Day } from "@/lib/types";
import { BlockEditor } from "@/components/BlockEditor";
import { WeightChart } from "@/components/WeightChart";
import { DateField } from "@/components/DateField";
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  SectionTitle,
  Segmented,
} from "@/components/ui";

type View = "today" | "table";

const VIEWS = [
  { id: "today" as const, label: "The day" },
  { id: "table" as const, label: "All entries" },
];

export default function JournalPage() {
  const store = useStore();
  const [view, setView] = useState<View>("today");
  const [date, setDate] = useState(() => todayISO());

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const byDate = new Map(store.days.map((d) => [d.date, d]));
  const day = byDate.get(date) ?? { date, weight: null, reflection: [] };

  return (
    <div className="fade-up">
      <PageHeader
        title="Journal"
        subtitle="One page a day — the number on the scale, and what was actually going on."
      />

      <WeightSummary days={store.days} />

      <div className="mb-5 mt-8">
        <Segmented options={VIEWS} value={view} onChange={setView} label="Journal views" />
      </div>

      {view === "today" ? (
        <DayPage
          day={day}
          date={date}
          setDate={setDate}
          onWeight={(weight) => store.setDay(date, { weight })}
          onReflection={(reflection) => store.setDay(date, { reflection })}
        />
      ) : (
        <EntryTable
          days={store.days}
          onOpen={(d) => {
            setDate(d);
            setView("today");
          }}
          onDelete={(d) => store.deleteDay(d)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function WeightSummary({ days }: { days: Day[] }) {
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
      // Week against week, not yesterday against today: a single morning says
      // more about salt and sleep than about any trend.
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
                    style={{
                      color:
                        Math.abs(stats.change) < 0.1
                          ? "var(--flat)"
                          : stats.change < 0
                            ? "var(--up)"
                            : "var(--high)",
                    }}
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
              <span className="nums text-ink-3">{stats.count} weigh-ins</span>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">No weigh-ins yet</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              Log one below. The chart compares this week against last rather than yesterday
              against today, so a heavy dinner does not look like progress lost.
            </p>
          </>
        )}
      </div>

      <WeightChart days={days} />
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

function DayPage({
  day,
  date,
  setDate,
  onWeight,
  onReflection,
}: {
  day: Day;
  date: string;
  setDate: (d: string) => void;
  onWeight: (weight: number | null) => void;
  onReflection: (blocks: Block[]) => void;
}) {
  const today = todayISO();

  return (
    <Panel className="px-4 py-4 sm:px-6 sm:py-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Step
            label="Previous day"
            onClick={() => setDate(addDays(date, -1))}
            d="M10 3.5 L5.5 8 L10 12.5"
          />
          <div>
            <p className="text-base font-semibold tracking-tight">{formatDate(date)}</p>
            <p className="text-xs text-ink-3">{pastLabel(date)}</p>
          </div>
          <Step
            label="Next day"
            onClick={() => setDate(addDays(date, 1))}
            d="M6 3.5 L10.5 8 L6 12.5"
          />
        </div>

        <div className="flex items-center gap-2">
          {date !== today && (
            <Button size="sm" onClick={() => setDate(today)}>
              Today
            </Button>
          )}
          <div className="w-[190px]">
            <DateField value={date} onChange={(v) => setDate(v || today)} />
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 border-b border-line pb-5">
        <WeightInput value={day.weight} onChange={onWeight} />
        <QuickWeights current={day.weight} onPick={onWeight} />
      </div>

      <SectionTitle>Reflection</SectionTitle>
      <BlockEditor
        blocks={day.reflection}
        onChange={onReflection}
        placeholder="How did it go? Press / for a heading, list or checkbox."
      />
    </Panel>
  );
}

function Step({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4">
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * The weigh-in.
 *
 * Text rather than `type="number"`, so a stray scroll over the field cannot
 * silently change a recorded weight, and so a comma works for anyone whose
 * scale or keyboard uses one.
 */
function WeightInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (weight: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [dirty, setDirty] = useState(false);

  // Follow the day being viewed, unless the field is mid-edit.
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
      setText(value == null ? "" : String(value));
      return;
    }
    onChange(Math.round(n * 10) / 10);
  };

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">Weight</span>
      <span className="relative inline-block">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
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
 * Bodyweight moves in tenths, and typing "72.4" every morning to change one
 * digit is the kind of friction that ends a logging habit.
 */
function QuickWeights({
  current,
  onPick,
}: {
  current: number | null;
  onPick: (weight: number) => void;
}) {
  const base = current ?? 72;
  const options = [-0.4, -0.2, 0, 0.2, 0.4].map((d) => Math.round((base + d) * 10) / 10);

  if (current == null) return null;

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

/* -------------------------------------------------------------------------- */

function EntryTable({
  days,
  onOpen,
  onDelete,
}: {
  days: Day[];
  onOpen: (date: string) => void;
  onDelete: (date: string) => void;
}) {
  if (days.length === 0) {
    return (
      <EmptyState
        title="Nothing logged yet"
        hint="Every day you write down lands here, newest first, with the change from the day before."
      />
    );
  }

  // Newest first, with each row's delta measured against the previous
  // weigh-in rather than the previous row — the gap between them may be days.
  const sorted = [...days].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Panel className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <Th>Date</Th>
              <Th className="text-right">Weight</Th>
              <Th className="text-right">Change</Th>
              <Th>Reflection</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((day, i) => {
              const previous = sorted.slice(i + 1).find((d) => d.weight != null);
              const delta =
                day.weight != null && previous?.weight != null
                  ? day.weight - previous.weight
                  : null;

              return (
                <tr
                  key={day.date}
                  className="group border-b border-line last:border-0 transition-colors hover:bg-panel-2"
                >
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => onOpen(day.date)}
                      className="text-left font-medium transition-colors hover:text-accent-text"
                    >
                      {formatDate(day.date)}
                      <span className="ml-2 text-xs font-normal text-ink-3">
                        {pastLabel(day.date)}
                      </span>
                    </button>
                  </td>
                  <td className="nums px-3 py-2.5 text-right">
                    {day.weight == null ? (
                      <span className="text-ink-3">—</span>
                    ) : (
                      day.weight.toFixed(1)
                    )}
                  </td>
                  <td className="nums px-3 py-2.5 text-right">
                    {delta == null ? (
                      <span className="text-ink-3">—</span>
                    ) : (
                      <span
                        style={{
                          color:
                            Math.abs(delta) < 0.05
                              ? "var(--flat)"
                              : delta < 0
                                ? "var(--up)"
                                : "var(--high)",
                        }}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className="max-w-0 px-3 py-2.5">
                    <p className="line-clamp-1 text-ink-2">{summarise(day.reflection)}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => onDelete(day.date)}
                      aria-label={`Delete entry for ${formatDate(day.date)}`}
                      className="grid size-7 place-items-center rounded-md text-ink-3 opacity-0 transition-[opacity,background-color,color] hover:bg-panel hover:text-[var(--urgent)] focus:opacity-100 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                        <path
                          d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3 ${className}`}
    >
      {children}
    </th>
  );
}

/** First line with words in it, so the row shows the entry rather than "‎". */
function summarise(blocks: Block[]): string {
  const first = blocks.find((b) => b.text.trim() !== "");
  if (!first) return "—";
  const rest = blocks.filter((b) => b.text.trim() !== "").length - 1;
  return rest > 0 ? `${first.text} · +${rest} more` : first.text;
}
