"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { formatDate, pastLabel, todayISO } from "@/lib/dates";
import { Day } from "@/lib/types";
import { DEFAULT_TARGET, GYM_TARGET_KEY, GymCell, gymStats, gymWall, readTarget } from "@/lib/gym";
import { WeighIn, WeightSummary, trendColor } from "@/components/WeightPanel";
import { EmptyState, PageHeader, Panel, SectionTitle } from "@/components/ui";
import { springSnappy } from "@/lib/motion";

const GREEN = "var(--up)";
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function GymPage() {
  const store = useStore();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [target, setTargetState] = useState(DEFAULT_TARGET);
  useEffect(() => setTargetState(readTarget()), []);
  const setTarget = (n: number) => {
    setTargetState(n);
    try {
      localStorage.setItem(GYM_TARGET_KEY, String(n));
    } catch {}
  };

  const stats = useMemo(() => gymStats(store.days, target, today), [store.days, target, today]);
  const wall = useMemo(() => gymWall(store.days, target, today), [store.days, target, today]);

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const trainedOn = (d: string) => store.days.find((x) => x.date === d)?.gym === true;
  const toggle = (d: string) => store.setDay(d, { gym: !trainedOn(d) });

  return (
    <div className="page-in">
      <PageHeader title="Gym" subtitle="Show up, tap the button. Weeks that hit your target light up." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <TrainCard trained={trainedOn(today)} onToggle={() => toggle(today)} stats={stats} target={target} />
        <div className="grid grid-cols-2 gap-3">
          <Stat value={stats.weekStreak} unit={stats.weekStreak === 1 ? "week" : "weeks"} label="Streak" hint={`weeks in a row at ${target}+`} hot={stats.weekStreak > 0} />
          <Stat value={stats.bestWeekStreak} unit={stats.bestWeekStreak === 1 ? "week" : "weeks"} label="Best streak" hint="your record so far" />
          <Stat value={stats.last30} unit="sessions" label="Last 30 days" hint={`≈ ${(stats.last30 / 4.3).toFixed(1)} a week`} />
          <Stat
            value={stats.total}
            unit="total"
            label="All time"
            hint={stats.sinceLast == null ? "first one is the hardest" : stats.sinceLast === 0 ? "last: today" : `last: ${stats.sinceLast}d ago`}
          />
        </div>
      </div>

      <Panel className="mt-4 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">Consistency</h2>
            <p className="text-xs text-ink-3">Tap any past square to fix it.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-3">
            <span>Target</span>
            <div className="flex gap-0.5 rounded-lg border border-line bg-panel-2 p-0.5">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setTarget(n)}
                  className={`nums h-6 w-7 rounded-md text-[12px] font-semibold transition-colors ${
                    n === target ? "bg-panel text-ink shadow-[var(--shadow),var(--edge)]" : "hover:text-ink"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <span>/ week</span>
          </div>
        </div>
        <GymGrid weeks={wall.weeks} months={wall.months} today={today} onToggle={toggle} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-3">
          <WeekdayBars counts={stats.byWeekday} />
          <div className="flex items-center gap-3">
            <Legend swatch={<span className="size-2.5 rounded-[3px] bg-panel-2" />} label="Rest" />
            <Legend swatch={<span className="size-2.5 rounded-[3px]" style={{ background: `color-mix(in srgb, ${GREEN} 45%, transparent)` }} />} label="Trained" />
            <Legend swatch={<span className="size-2.5 rounded-[3px]" style={{ background: GREEN }} />} label="Target week" />
          </div>
        </div>
      </Panel>

      <section className="mt-10">
        <SectionTitle>Weight</SectionTitle>
        <WeightSummary days={store.days} />
        <div className="mt-4">
          <WeighIn date={date} onDate={setDate} days={store.days} onSave={(weight) => store.setDay(date, { weight })} />
          {date !== today && (
            <p className="mt-2 text-xs text-ink-3">
              Logging against {formatDate(date)} — {pastLabel(date).toLowerCase()}.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle>History</SectionTitle>
        <WeightTable days={store.days} onOpen={setDate} onClear={(d) => store.setDay(d, { weight: null })} />
      </section>
    </div>
  );
}

/* ------------------------------- Today's card ------------------------------ */

function TrainCard({
  trained,
  onToggle,
  stats,
  target,
}: {
  trained: boolean;
  onToggle: () => void;
  stats: ReturnType<typeof gymStats>;
  target: number;
}) {
  const left = Math.max(0, target - stats.thisWeek);
  const message = trained
    ? left === 0
      ? stats.thisWeek > target
        ? "Above target this week. Animal."
        : "Target hit for the week. Streak safe."
      : `Logged. ${left} more this week to hit ${target}.`
    : stats.sinceLast != null && stats.sinceLast >= 3
      ? `${stats.sinceLast} days since the last one. Today fixes that.`
      : left === 0
        ? "Week's target is done — anything now is extra."
        : `${left} to go this week.`;

  return (
    <Panel className="relative overflow-hidden p-5">
      <div className="flex items-center gap-5">
        <motion.button
          onClick={onToggle}
          whileTap={{ scale: 0.92 }}
          transition={springSnappy}
          aria-pressed={trained}
          className="relative grid size-[104px] shrink-0 place-items-center rounded-full outline-none"
          style={{
            background: trained ? GREEN : "var(--panel-2)",
            boxShadow: trained ? `0 10px 30px -10px ${GREEN}` : "inset 0 0 0 2px var(--border)",
            transition: "background 220ms, box-shadow 220ms",
          }}
        >
          <AnimatePresence>
            {trained && (
              <motion.span
                key="ring"
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ border: `3px solid ${GREEN}` }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            {trained ? (
              <motion.svg
                key="tick"
                viewBox="0 0 24 24"
                className="size-11 text-white"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={springSnappy}
              >
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35, delay: 0.05 }}
                />
              </motion.svg>
            ) : (
              <motion.svg
                key="db"
                viewBox="0 0 24 24"
                className="size-11 text-ink-2"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={springSnappy}
              >
                <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3.2" y="8" width="3" height="8" rx="1" />
                  <rect x="17.8" y="8" width="3" height="8" rx="1" />
                  <rect x="6.2" y="9.5" width="2" height="5" rx=".6" />
                  <rect x="15.8" y="9.5" width="2" height="5" rx=".6" />
                  <path d="M8.2 12h7.6" />
                </g>
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>

        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Today</p>
          <p className="mt-0.5 text-[20px] font-bold leading-tight tracking-tight">
            {trained ? "Trained ✓" : "Went to the gym?"}
          </p>
          <p className="mt-1 text-[13px] text-ink-2">{message}</p>
          <p className="mt-1 text-[11px] text-ink-3">{trained ? "Tap again to undo." : "Tap the button when you're done."}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="font-semibold text-ink-2">This week</span>
          <span className="nums text-ink-3">
            <b className="text-ink">{stats.thisWeek}</b> / {target}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {stats.weekDays.map((d, i) => (
            <div key={i} className="text-center">
              <motion.div
                animate={{ scale: d ? [0.85, 1.08, 1] : 1 }}
                transition={{ duration: 0.35 }}
                className="h-7 rounded-md"
                style={{
                  background: d ? GREEN : d === null ? "transparent" : "var(--panel-2)",
                  border: d === null ? "1.5px dashed var(--border)" : "none",
                }}
              />
              <span className="mt-1 block text-[10px] font-medium text-ink-3">{WEEK[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Stat({
  value,
  unit,
  label,
  hint,
  hot = false,
}: {
  value: number;
  unit: string;
  label: string;
  hint: string;
  hot?: boolean;
}) {
  return (
    <Panel className="flex flex-col justify-between p-4">
      <p className="text-[12px] font-semibold text-ink-3">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <motion.span
          key={value}
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="nums text-[30px] font-bold leading-none tracking-tight"
          style={hot ? { color: GREEN } : undefined}
        >
          {value}
        </motion.span>
        <span className="text-[13px] text-ink-3">{unit}</span>
      </p>
      <p className="mt-1.5 text-[11px] text-ink-3">{hint}</p>
    </Panel>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
}

function WeekdayBars({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  if (counts.every((c) => c === 0)) return <span>Your gym days will show up here.</span>;
  return (
    <div className="flex items-end gap-1.5" title="Sessions per weekday">
      {counts.map((c, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div className="flex h-6 w-3 items-end overflow-hidden rounded-[3px] bg-panel-2">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(c / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.03 }}
              className="w-full rounded-[3px]"
              style={{ background: GREEN }}
            />
          </div>
          <span className="text-[9px]">{WEEK[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- The wall -------------------------------- */

const GAP = 3;

function GymGrid({
  weeks,
  months,
  today,
  onToggle,
}: {
  weeks: GymCell[][];
  months: { label: string; column: number }[];
  today: string;
  onToggle: (date: string) => void;
}) {
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
  const cell = width ? Math.max(11, Math.min(20, Math.floor((width - GAP * (weeks.length - 1)) / weeks.length))) : 12;
  useEffect(() => {
    const el = strip.current;
    const now = el?.querySelector<HTMLElement>("[data-today]");
    if (el && now && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += now.getBoundingClientRect().left - el.getBoundingClientRect().left - el.clientWidth / 2;
    }
  }, [cell, weeks.length]);

  return (
    <div className="flex gap-2">
      <div className="flex shrink-0 flex-col pt-[18px] text-[10px] text-ink-3" style={{ gap: GAP }}>
        {WEEKDAY.map((d, i) => (
          <span key={d} className="flex items-center" style={{ height: cell, visibility: i % 2 === 0 ? "visible" : "hidden" }}>
            {d}
          </span>
        ))}
      </div>
      <div ref={strip} className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div className="relative" style={{ width: weeks.length * (cell + GAP) - GAP }}>
          <div className="relative h-[18px] text-[10px] text-ink-3">
            {months.map((m) => (
              <span key={`${m.label}-${m.column}`} className="absolute top-0" style={{ left: m.column * (cell + GAP) }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex" style={{ gap: GAP }}>
            {weeks.map((week, w) => (
              <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                {week.map((c) => {
                  const isToday = c.date === today;
                  const bg = c.future
                    ? "transparent"
                    : c.trained
                      ? c.fullWeek
                        ? GREEN
                        : `color-mix(in srgb, ${GREEN} 45%, transparent)`
                      : "var(--panel-2)";
                  const label = `${new Date(`${c.date}T12:00:00`).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })} · ${c.future ? "ahead" : c.trained ? "trained — tap to undo" : "rest — tap if you trained"}`;
                  return (
                    <motion.button
                      key={c.date}
                      data-today={isToday ? "" : undefined}
                      disabled={c.future}
                      onClick={() => onToggle(c.date)}
                      title={label}
                      aria-label={label}
                      whileHover={c.future ? undefined : { scale: 1.25 }}
                      animate={{ scale: c.trained ? [0.6, 1.15, 1] : 1 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-[3px] disabled:cursor-default"
                      style={{
                        width: cell,
                        height: cell,
                        background: bg,
                        border: c.future ? "1px dashed var(--border)" : "none",
                        outline: isToday ? "2px solid var(--ink)" : "none",
                        outlineOffset: 1,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Weight history ----------------------------- */

function WeightTable({
  days,
  onOpen,
  onClear,
}: {
  days: Day[];
  onOpen: (date: string) => void;
  onClear: (date: string) => void;
}) {
  const [all, setAll] = useState(false);
  const rows = useMemo(
    () => days.filter((d) => d.weight != null).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [days],
  );

  if (rows.length === 0) {
    return <EmptyState title="No weigh-ins yet" hint="Log one above and it lands here, newest first." />;
  }
  const shown = all ? rows : rows.slice(0, 8);

  return (
    <Panel className="overflow-hidden">
      <ul className="divide-y divide-line">
        {shown.map((day, i) => {
          const previous = rows[i + 1];
          const delta = previous?.weight != null && day.weight != null ? day.weight - previous.weight : null;
          return (
            <li key={day.date} className="group flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-panel-2">
              <button onClick={() => onOpen(day.date)} className="min-w-0 flex-1 text-left font-medium hover:text-accent-text">
                {formatDate(day.date)}
                <span className="ml-2 text-xs font-normal text-ink-3">{pastLabel(day.date)}</span>
                {day.gym && <span className="ml-2 text-[11px] font-semibold" style={{ color: GREEN }}>gym</span>}
              </button>
              <span className="nums w-16 text-right font-semibold">{day.weight?.toFixed(1)}</span>
              <span className="nums w-14 text-right text-[13px]">
                {delta == null ? (
                  <span className="text-ink-3">—</span>
                ) : (
                  <span style={{ color: trendColor(delta) }}>
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </span>
                )}
              </span>
              <button
                onClick={() => onClear(day.date)}
                aria-label={`Remove the weigh-in for ${formatDate(day.date)}`}
                title="Remove this weigh-in"
                className="grid size-7 place-items-center rounded-md text-ink-3 opacity-0 transition-[opacity,color] hover:text-[var(--urgent)] focus:opacity-100 group-hover:opacity-100"
              >
                <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                  <path d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length > 8 && (
        <button onClick={() => setAll((v) => !v)} className="w-full border-t border-line py-2 text-xs font-medium text-ink-3 hover:text-ink">
          {all ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </Panel>
  );
}

