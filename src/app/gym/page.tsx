"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { addDays, formatDate, pastLabel, todayISO } from "@/lib/dates";
import { startOfWeek } from "@/lib/calendar";
import { Day } from "@/lib/types";
import { DEFAULT_PLAN, GymCell, GymPlan, gymStats, gymWall, isPlanned, readPlan, savePlan } from "@/lib/gym";
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
  // undefined while loading, null until the days have been chosen once.
  const [saved, setSaved] = useState<GymPlan | null | undefined>(undefined);
  useEffect(() => setSaved(readPlan()), []);
  const plan = saved ?? DEFAULT_PLAN;
  const setPlan = (next: GymPlan) => {
    setSaved(next);
    savePlan(next);
  };

  const stats = useMemo(() => gymStats(store.days, plan, today), [store.days, plan, today]);
  const wall = useMemo(() => gymWall(store.days, plan, today), [store.days, plan, today]);
  const target = stats.target;

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const trainedOn = (d: string) => store.days.find((x) => x.date === d)?.gym === true;
  const toggle = (d: string) => store.setDay(d, { gym: !trainedOn(d) });

  return (
    <div className="page-in">
      <PageHeader title="Gym" subtitle="Show up, tap the button. A week that hits its target is a full week, rest days included." />

      {saved === null && <PlanSetup onSave={setPlan} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <TrainCard
          today={today}
          trained={trainedOn(today)}
          trainedYesterday={trainedOn(addDays(today, -1))}
          onToggle={() => toggle(today)}
          onToggleDay={toggle}
          stats={stats}
          target={target}
          plannedToday={isPlanned(today, plan)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Stat value={stats.weekStreak} unit={stats.weekStreak === 1 ? "week" : "weeks"} label="Streak" hint={`full weeks in a row · ${stats.summer ? "summer" : "school"} target ${target}`} hot={stats.weekStreak > 0} />
          <Stat value={stats.bestWeekStreak} unit={stats.bestWeekStreak === 1 ? "week" : "weeks"} label="Best streak" hint="your record so far" />
          <Stat value={stats.last30} unit="sessions" label="Last 30 days" hint={perWeek(stats.last30, stats.first, today)} />
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
            <p className="text-xs text-ink-3">
              {stats.first
                ? `${stats.total} ${stats.total === 1 ? "session" : "sessions"} since ${formatDate(stats.first)} · tap any past square to fix it`
                : "Tap any past square to fix it."}
            </p>
          </div>
          <PlanPicker plan={plan} onChange={setPlan} />
        </div>
        <GymGrid weeks={wall.weeks} months={wall.months} today={today} onToggle={toggle} />
        <div className="mt-5 grid gap-5 border-t border-line pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <WeekdayBars counts={stats.byWeekday} />
          <Summary weeks={wall.weeks} today={today} total={stats.total} first={stats.first} />
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

function perWeek(n: number, first: string | null, today: string): string {
  if (!first) return "nothing logged yet";
  const days = Math.min(30, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${first}T12:00:00`)) / 86_400_000) + 1);
  if (days < 7) return `in your first ${days} ${days === 1 ? "day" : "days"}`;
  return `≈ ${((n / days) * 7).toFixed(1)} a week`;
}

/* ------------------------------ Seasonal targets ----------------------------- */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function daysText(days: number[]): string {
  if (days.length === 7) return "every day";
  if (days.length === 5 && [0, 1, 2, 3, 4].every((d) => days.includes(d))) return "weekdays";
  return days.map((d) => DAY_NAMES[d]).join(" ");
}

function DayChips({ value, onChange, label }: { value: number[]; onChange: (v: number[]) => void; label: string }) {
  const flip = (d: number) => {
    const next = value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((x, y) => x - y);
    if (next.length) onChange(next);
  };
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[12px] font-semibold text-ink-2">{label}</span>
      <div className="flex gap-1">
        {DAY_NAMES.map((name, d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => flip(d)}
              aria-pressed={on}
              className={`h-7 w-9 rounded-md text-[11.5px] font-semibold transition-colors ${
                on ? "text-white" : "bg-panel-2 text-ink-3 hover:text-ink"
              }`}
              style={on ? { background: GREEN } : undefined}
            >
              {name}
            </button>
          );
        })}
      </div>
      <span className="nums text-[11px] text-ink-3">{value.length}/wk</span>
    </div>
  );
}

function PlanEditor({ plan, onChange }: { plan: GymPlan; onChange: (p: GymPlan) => void }) {
  const year = new Date().getFullYear();
  const date =
    "h-7 rounded-md border border-line bg-panel-2 px-1.5 text-[12px] text-ink outline-none focus:border-[var(--accent)] [color-scheme:dark]";
  return (
    <div className="grid gap-2.5">
      <DayChips label="School" value={plan.schoolDays} onChange={(v) => onChange({ ...plan, schoolDays: v })} />
      <DayChips label="Summer" value={plan.summerDays} onChange={(v) => onChange({ ...plan, summerDays: v })} />
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
        <span className="w-14 shrink-0 font-semibold text-ink-2">Dates</span>
        <input
          type="date"
          aria-label="Summer starts"
          value={`${year}-${plan.summerFrom}`}
          onChange={(e) => e.target.value && onChange({ ...plan, summerFrom: e.target.value.slice(5) })}
          className={date}
        />
        –
        <input
          type="date"
          aria-label="Summer ends"
          value={`${year}-${plan.summerTo}`}
          onChange={(e) => e.target.value && onChange({ ...plan, summerTo: e.target.value.slice(5) })}
          className={date}
        />
        <span className="text-[11px]">summer, every year</span>
      </div>
    </div>
  );
}

/** Shown once, before the days were ever chosen. */
function PlanSetup({ onSave }: { onSave: (p: GymPlan) => void }) {
  const [draft, setDraft] = useState<GymPlan>(DEFAULT_PLAN);
  return (
    <Panel className="mb-4 p-5">
      <h2 className="text-[15px] font-bold tracking-tight">Which days do you train?</h2>
      <p className="mb-4 mt-1 max-w-xl text-[13px] text-ink-2">
        Pick your gym days for the school year and for the summer. The number of days is the week&apos;s target, and a
        session on any other day still counts. You can change this any time.
      </p>
      <PlanEditor plan={draft} onChange={setDraft} />
      <button
        type="button"
        onClick={() => onSave(draft)}
        className="mt-4 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--accent)" }}
      >
        Save my days
      </button>
    </Panel>
  );
}

function PlanPicker({ plan, onChange }: { plan: GymPlan; onChange: (p: GymPlan) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2 text-xs text-ink-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-md px-2 py-1 text-right transition-colors hover:bg-panel-2 hover:text-ink"
        title="Change your gym days"
      >
        School <b className="font-semibold text-ink-2">{daysText(plan.schoolDays)}</b>
        <span className="mx-1.5">·</span>
        Summer <b className="font-semibold text-ink-2">{daysText(plan.summerDays)}</b>
        <span className="ml-1.5 underline decoration-dotted underline-offset-2">{open ? "done" : "edit"}</span>
      </button>
      {open && (
        <div className="rounded-xl border border-line bg-panel-2/40 p-3">
          <PlanEditor plan={plan} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Today's card ------------------------------ */

function TrainCard({
  today,
  trained,
  trainedYesterday,
  onToggle,
  onToggleDay,
  stats,
  target,
  plannedToday,
}: {
  today: string;
  trained: boolean;
  trainedYesterday: boolean;
  onToggle: () => void;
  onToggleDay: (date: string) => void;
  stats: ReturnType<typeof gymStats>;
  target: number;
  plannedToday: boolean;
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
        : plannedToday
          ? `Gym day today. ${left} to go this week.`
          : `Rest day by plan — a session still counts. ${left} to go.`;

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
                key="done"
                viewBox="0 0 24 24"
                className="size-12 text-white"
                initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={springSnappy}
              >
                <g fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
                  <rect x="3.2" y="8" width="3" height="8" rx="1" />
                  <rect x="17.8" y="8" width="3" height="8" rx="1" />
                  <rect x="6.2" y="9.5" width="2" height="5" rx=".6" />
                  <rect x="15.8" y="9.5" width="2" height="5" rx=".6" />
                  <rect x="8.2" y="11.1" width="7.6" height="1.8" rx=".5" />
                </g>
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
            {trained ? "Trained today" : "Went to the gym?"}
          </p>
          <p className="mt-1 text-[13px] text-ink-2">{message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
            <span>{trained ? "Tap again to undo." : "Tap the button when you're done."}</span>
            <button
              onClick={() => onToggleDay(addDays(today, -1))}
              className="rounded-md border border-line px-2 py-0.5 font-medium transition-colors hover:bg-panel-2 hover:text-ink"
              style={trainedYesterday ? { color: GREEN, borderColor: GREEN } : undefined}
            >
              {trainedYesterday ? "Yesterday logged" : "+ Yesterday"}
            </button>
          </div>
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
          {stats.weekDays.map((d, i) => {
            const date = addDays(startOfWeek(today), i);
            return (
            <div key={i} className="text-center">
              <motion.button
                disabled={d === null}
                onClick={() => onToggleDay(date)}
                whileHover={d === null ? undefined : { scale: 1.06 }}
                whileTap={d === null ? undefined : { scale: 0.92 }}
                animate={{ scale: d ? [0.85, 1.08, 1] : 1 }}
                transition={{ duration: 0.35 }}
                title={d === null ? "Still ahead" : `${formatDate(date)} — ${d ? "tap to undo" : "tap if you trained"}`}
                className="block h-7 w-full rounded-md disabled:cursor-default"
                style={{
                  background: d ? GREEN : d === null ? "transparent" : "var(--panel-2)",
                  border:
                    d === null
                      ? `1.5px dashed ${stats.planned[i] ? `color-mix(in srgb, ${GREEN} 60%, transparent)` : "var(--border)"}`
                      : "none",
                  boxShadow: date === today ? "0 0 0 2px var(--panel), 0 0 0 3.5px var(--accent)" : undefined,
                }}
              />
              <span className={`mt-1 block text-[10px] ${stats.planned[i] ? "font-bold text-ink-2" : "font-medium text-ink-3"}`}>
                {WEEK[i]}
              </span>
            </div>
            );
          })}
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

const WEEKDAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function WeekdayBars({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const best = total ? counts.indexOf(Math.max(...counts)) : -1;
  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold text-ink-2">
        Your gym days
        {best >= 0 && <span className="ml-2 font-normal text-ink-3">most often on {WEEKDAY_FULL[best]}s</span>}
      </p>
      <div className="flex gap-3">
        {counts.map((c, i) => (
          <div key={i} className="flex w-9 flex-col items-center gap-1" title={`${WEEKDAY_FULL[i]}: ${c} ${c === 1 ? "session" : "sessions"}`}>
            <span className={`nums text-[11px] font-semibold ${c ? "text-ink" : "text-ink-3"}`}>{c}</span>
            <div className="flex h-14 w-3.5 items-end overflow-hidden rounded-full bg-panel-2">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(c / max) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
                className="w-full rounded-full"
                style={{ background: i === best ? GREEN : `color-mix(in srgb, ${GREEN} 55%, transparent)` }}
              />
            </div>
            <span className={`text-[11px] ${i === best ? "font-semibold text-ink" : "text-ink-3"}`}>{WEEKDAY[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Summary({ weeks, today, total, first }: { weeks: GymCell[][]; today: string; total: number; first: string | null }) {
  const past = weeks.filter((w) => w[0].date <= today);
  const hit = past.filter((w) => w[0].fullWeek).length;
  const avg = past.length ? total / past.length : 0;
  const tracked = first ? Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${first}T12:00:00`)) / 86_400_000) + 1 : 0;
  return (
    <div className="flex flex-wrap items-end gap-6">
      <Figure value={`${hit}/${past.length}`} label="full weeks" />
      <Figure value={avg.toFixed(1)} label="avg / week" />
      <Figure value={String(tracked)} label="days tracked" />
      <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
        <span>Rest</span>
        <span className="size-3 rounded-[3px] bg-panel-2" />
        <span className="size-3 rounded-[3px]" style={{ background: `color-mix(in srgb, ${GREEN} 45%, transparent)` }} />
        <span className="size-3 rounded-[3px]" style={{ background: COVERED }} />
        <span className="size-3 rounded-[3px]" style={{ background: GREEN }} />
        <span>Full week</span>
      </div>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="nums text-[18px] font-bold leading-none tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

/* ---------------------------------- The wall -------------------------------- */

const GAP = 4;
const COVERED = `color-mix(in srgb, ${GREEN} 22%, var(--panel-2))`;
const SUMMER = "#e0a84a";

function seasonRuns(weeks: GymCell[][]): { start: number; length: number; target: number }[] {
  const runs: { start: number; length: number; target: number }[] = [];
  weeks.forEach((w, i) => {
    if (!w[0].summer) return;
    const last = runs.at(-1);
    if (last && last.start + last.length === i) last.length += 1;
    else runs.push({ start: i, length: 1, target: w[0].target });
  });
  return runs;
}

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
  const cell = width ? Math.max(width < 520 ? 20 : 12, Math.min(22, Math.floor((width - 12 - GAP * (weeks.length - 1)) / weeks.length))) : 14;
  const step = cell + GAP;
  useEffect(() => {
    const el = strip.current;
    const now = el?.querySelector<HTMLElement>("[data-today]");
    if (el && now && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += now.getBoundingClientRect().left - el.getBoundingClientRect().left - el.clientWidth / 3;
    }
  }, [cell, weeks.length]);
  const todayCol = weeks.findIndex((w) => w.some((c) => c.date === today));
  const dayLabel = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="flex gap-2.5">
      {/* Every weekday named, aligned to its row. */}
      <div className="flex shrink-0 flex-col text-[11px] text-ink-3" style={{ gap: GAP, paddingTop: 38 }}>
        {WEEKDAY.map((d, i) => (
          <span key={d} className={`flex items-center ${i >= 5 ? "text-ink-2" : ""}`} style={{ height: cell }}>
            {d}
          </span>
        ))}
        <span className="mt-1 flex items-center text-[10px]" style={{ height: 16 }}>
          Week
        </span>
      </div>

      <div ref={strip} className="min-w-0 flex-1 overflow-x-auto pb-1 pl-1.5 pr-1">
        <div className="relative" style={{ width: weeks.length * step - GAP }}>
          {/* Summer runs, so the higher bar shows where it applies. */}
          <div className="relative h-4">
            {seasonRuns(weeks).map((r) => (
              <span
                key={r.start}
                className="absolute top-0 flex h-4 items-center gap-1.5"
                style={{ left: r.start * step, width: r.length * step - GAP }}
                title={`Summer: ${r.target} a week`}
              >
                <span className="whitespace-nowrap text-[10px] font-semibold leading-none" style={{ color: SUMMER }}>
                  summer · {r.target === 7 ? "daily" : `${r.target}/wk`}
                </span>
                <span className="h-[2px] min-w-0 flex-1 rounded-full" style={{ background: SUMMER, opacity: 0.6 }} />
              </span>
            ))}
          </div>
          {/* Months, each with a tick where it starts. */}
          <div className="relative h-[22px] text-[11px] text-ink-3">
            {months.map((m) => (
              <span key={`${m.label}-${m.column}`} className="absolute top-0 flex items-center gap-1" style={{ left: m.column * step }}>
                <span className="h-2.5 w-px bg-[var(--border)]" />
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {weeks.map((week, w) => {
              const started = week[0].date <= today;
              const n = week.filter((c) => c.trained).length;
              const target = week[0].target;
              return (
                <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                  {week.map((c) => {
                    const isToday = c.date === today;
                    // A week that hit its target is a full week: its rest days
                    // are part of it, not gaps, so they carry the colour too.
                    const bg = c.trained
                      ? c.fullWeek
                        ? GREEN
                        : `color-mix(in srgb, ${GREEN} 45%, transparent)`
                      : c.fullWeek
                        ? COVERED
                        : c.future
                          ? "color-mix(in srgb, var(--panel-2) 45%, transparent)"
                          : "var(--panel-2)";
                    const label = `${dayLabel(c.date)} · ${
                      c.trained
                        ? "trained — tap to undo"
                        : c.fullWeek
                          ? `rest — week already at ${c.target}`
                          : c.future
                            ? c.planned
                              ? "planned gym day"
                              : "ahead"
                            : "rest — tap if you trained"
                    }`;
                    return (
                      <motion.button
                        key={c.date}
                        data-today={isToday ? "" : undefined}
                        disabled={c.future}
                        onClick={() => onToggle(c.date)}
                        title={label}
                        aria-label={label}
                        whileHover={c.future ? undefined : { scale: 1.2 }}
                        animate={{ scale: c.trained ? [0.6, 1.15, 1] : 1 }}
                        transition={{ duration: 0.3 }}
                        className="rounded-[4px] disabled:cursor-default"
                        style={{
                          width: cell,
                          height: cell,
                          background: bg,
                          boxShadow: isToday
                            ? "0 0 0 2px var(--panel), 0 0 0 3.5px var(--accent)"
                            : c.planned && !c.trained && !c.fullWeek && c.future
                              ? `inset 0 0 0 1.5px color-mix(in srgb, ${GREEN} 45%, transparent)`
                              : undefined,
                        }}
                      />
                    );
                  })}

                  {/* The week's sessions against the target. */}
                  <div
                    className="mt-1 flex items-end overflow-hidden rounded-[3px]"
                    style={{ width: cell, height: 16, background: started ? "var(--panel-2)" : "transparent" }}
                    title={`Week of ${dayLabel(week[0].date)} · ${week[0].summer ? "summer" : "school"}: ${started ? `${n}/` : "target "}${target}`}
                  >
                    {started && n > 0 && (
                      <div
                        className="w-full"
                        style={{
                          height: `${Math.min(1, n / target) * 100}%`,
                          background: n >= target ? GREEN : `color-mix(in srgb, ${GREEN} 45%, transparent)`,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {todayCol >= 0 && (
            <div className="relative mt-1 h-4">
              <span
                className="absolute top-0 text-[10px] font-bold uppercase tracking-wider text-accent-text"
                style={todayCol < 2 ? { left: 0 } : { left: todayCol * step + cell / 2, transform: "translateX(-50%)" }}
              >
                today
              </span>
            </div>
          )}
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

