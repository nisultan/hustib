import { AppData } from "./types";
import { addDays, todayISO } from "./dates";
import { appliesOn } from "./habits";

/**
 * How consistently the student is actually running their own system.
 *
 * Deliberately a measure of consistency rather than of output. Output belongs
 * to grades, which are already tracked and already honest; what this can see is
 * whether someone is showing up — weighing in, writing the day down, keeping
 * the habits they set, finishing what they planned. Those are the things a
 * student controls on a bad week, and scoring them is the only version of
 * "productivity" that does not just re-rank people by how easy their term is.
 *
 * Two rules keep it from becoming a stick to beat themselves with:
 *
 * - A signal the student does not use is not counted. Someone who never logs
 *   weight is not 20% worse at living; that signal simply is not part of their
 *   system, and its weight is redistributed across the ones that are.
 * - Today is excluded from the window. A day still being lived is not evidence
 *   of anything, and counting it means the score drops every morning and
 *   recovers every evening, which teaches people to ignore it.
 */

export type SignalKey = "weight" | "reflection" | "habits" | "plan" | "tasks";

export interface Signal {
  key: SignalKey;
  label: string;
  /** What this measures, shown under the bar. */
  detail: string;
  /** 0-1 over the window, or null when the student does not use this at all. */
  rate: number | null;
  /** Relative importance among the signals actually in use. */
  weight: number;
}

export interface Productivity {
  /** 0-100, or null when there is not enough history to mean anything. */
  score: number | null;
  /** Days up to and including yesterday with any activity at all. */
  streak: number;
  /** The longest such run on record, so a broken streak is not the whole story. */
  bestStreak: number;
  signals: Signal[];
  /** Days actually examined. */
  windowDays: number;
  /** Change against the window before this one, in points. */
  delta: number | null;
}

/** Long enough to survive one bad week, short enough to reflect this month. */
const WINDOW = 28;

/** Below this the number is noise dressed up as a measurement. */
const MIN_DAYS = 5;

const WEIGHTS: Record<SignalKey, number> = {
  // Showing up to write is the strongest signal of the five: it is the one
  // that takes real effort and the one everything else is reconstructed from.
  reflection: 1.2,
  habits: 1.2,
  plan: 1,
  tasks: 0.8,
  weight: 0.6,
};

export function productivity(data: AppData, today = todayISO()): Productivity {
  // Yesterday backwards. A day still in progress cannot be judged.
  const end = addDays(today, -1);
  const history = daysWithHistory(data, today);

  // Never longer than the student has actually been using the hub. Judging
  // four weeks of consistency against someone who started ten days ago counts
  // eighteen days they could not have logged, which reads as a damning score
  // for a good fortnight.
  const span = Math.max(1, Math.min(WINDOW, history));
  const days = Array.from({ length: span }, (_, i) => addDays(end, -i));

  const signals = measure(data, days);
  const previous = measure(
    data,
    Array.from({ length: span }, (_, i) => addDays(end, -(span + i))),
  );

  const score = history < MIN_DAYS ? null : combine(signals);
  const before = history < MIN_DAYS + span ? null : combine(previous);

  return {
    score,
    streak: streakFrom(data, end),
    bestStreak: bestStreak(data),
    signals,
    windowDays: span,
    delta: score != null && before != null ? Math.round(score - before) : null,
  };
}

/** A weighted mean over the signals in use, rescaled to 0-100. */
function combine(signals: Signal[]): number | null {
  const used = signals.filter((s) => s.rate != null);
  if (used.length === 0) return null;

  const total = used.reduce((sum, s) => sum + s.weight, 0);
  const earned = used.reduce((sum, s) => sum + (s.rate as number) * s.weight, 0);
  return Math.round((earned / total) * 100);
}

function measure(data: AppData, days: string[]): Signal[] {
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const window = new Set(days);

  const weighed = days.filter((d) => byDate.get(d)?.weight != null).length;
  const written = days.filter((d) =>
    byDate.get(d)?.reflection.some((b) => b.text.trim() !== ""),
  ).length;

  // Habits are scored per opportunity, not per day: keeping three of three on
  // a Monday should not be worth the same as keeping one of one on a Sunday.
  let habitDue = 0;
  let habitDone = 0;
  for (const date of days) {
    const due = data.habits.filter((h) => appliesOn(h, date));
    habitDue += due.length;
    const done = byDate.get(date)?.habitsDone ?? [];
    habitDone += due.filter((h) => done.includes(h.id)).length;
  }

  const planned = data.plan.filter((p) => window.has(p.date));
  const finished = planned.filter((p) => p.done).length;

  const closed = data.tasks.filter(
    (t) => t.completedAt != null && window.has(t.completedAt),
  ).length;
  // Tasks have no natural denominator, so this is scored against a modest
  // daily rate rather than against everything outstanding — otherwise a
  // student with a long backlog is permanently marked down for having one.
  const taskTarget = days.length * 0.75;

  return [
    {
      key: "reflection",
      label: "Reflection",
      detail: `${written} of ${days.length} days written`,
      rate: data.days.some((d) => d.reflection.some((b) => b.text.trim() !== ""))
        ? written / days.length
        : null,
      weight: WEIGHTS.reflection,
    },
    {
      key: "habits",
      label: "Habits",
      detail: habitDue === 0 ? "No habits set" : `${habitDone} of ${habitDue} kept`,
      rate: habitDue === 0 ? null : habitDone / habitDue,
      weight: WEIGHTS.habits,
    },
    {
      key: "plan",
      label: "Plan",
      detail:
        planned.length === 0 ? "Nothing planned" : `${finished} of ${planned.length} finished`,
      rate: planned.length === 0 ? null : finished / planned.length,
      weight: WEIGHTS.plan,
    },
    {
      key: "tasks",
      label: "Tasks",
      detail: `${closed} completed`,
      rate: data.tasks.length === 0 ? null : Math.min(1, closed / taskTarget),
      weight: WEIGHTS.tasks,
    },
    {
      key: "weight",
      label: "Weigh-ins",
      detail: `${weighed} of ${days.length} days`,
      rate: data.days.some((d) => d.weight != null) ? weighed / days.length : null,
      weight: WEIGHTS.weight,
    },
  ];
}

/** Any sign of life: a weigh-in, a reflection, a habit, or a finished plan. */
function active(data: AppData, date: string): boolean {
  const day = data.days.find((d) => d.date === date);
  if (day?.weight != null) return true;
  if (day?.reflection.some((b) => b.text.trim() !== "")) return true;
  if ((day?.habitsDone.length ?? 0) > 0) return true;
  if (data.plan.some((p) => p.date === date && p.done)) return true;
  return data.tasks.some((t) => t.completedAt === date);
}

function streakFrom(data: AppData, end: string): number {
  let streak = 0;
  for (let date = end; active(data, date); date = addDays(date, -1)) {
    streak += 1;
    // A streak longer than the record is a corrupt date somewhere, not a
    // decade of perfect days.
    if (streak > 3650) break;
  }
  return streak;
}

function bestStreak(data: AppData): number {
  const dates = new Set<string>();
  for (const d of data.days) dates.add(d.date);
  for (const p of data.plan) dates.add(p.date);
  for (const t of data.tasks) if (t.completedAt) dates.add(t.completedAt);

  const sorted = [...dates].filter((d) => active(data, d)).sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of sorted) {
    run = previous != null && addDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}

/** How many days of records exist, so a brand-new hub is not given a score. */
function daysWithHistory(data: AppData, today: string): number {
  const dates = new Set<string>();
  for (const d of data.days) {
    if (d.weight != null || d.reflection.some((b) => b.text.trim() !== "")) dates.add(d.date);
  }
  for (const p of data.plan) dates.add(p.date);
  for (const t of data.tasks) if (t.completedAt) dates.add(t.completedAt);

  const earliest = [...dates].sort()[0];
  if (!earliest) return 0;

  const span = Math.round(
    (Date.parse(`${today}T00:00:00`) - Date.parse(`${earliest}T00:00:00`)) / 86_400_000,
  );
  return Math.max(dates.size, Math.min(span, WINDOW));
}
