import { addDays, todayISO } from "./dates";
import { startOfWeek } from "./calendar";
import type { Day } from "./types";

/**
 * Gym days, counted the way training actually works.
 *
 * Nobody trains every day, so a day streak would break on every rest day and
 * mean nothing. The streak that matters is weekly: weeks in a row where the
 * weekly target was hit. The current week only counts once it is hit; until
 * then it is still in play and does not break anything.
 */

export const GYM_PLAN_KEY = "lockin.gym.plan";

/**
 * Your gym days, in two seasons. During school you might go Tue, Thu, Sat and
 * Sun; in the summer every day. A week's target is how many days you planned
 * for it, and any session counts towards it, planned day or not: a Wednesday
 * instead of a Thursday still fills the week.
 *
 * A week belongs to whichever season its Thursday falls in, so a week that
 * straddles the switch is judged by most of its days.
 */
export interface GymPlan {
  /** Weekdays, 0 = Monday .. 6 = Sunday. */
  schoolDays: number[];
  summerDays: number[];
  /** Month-day, "MM-DD", inclusive. */
  summerFrom: string;
  summerTo: string;
}

export const DEFAULT_PLAN: GymPlan = {
  schoolDays: [1, 3, 5, 6],
  summerDays: [0, 1, 2, 3, 4, 5, 6],
  summerFrom: "06-05",
  summerTo: "08-31",
};

const isMonthDay = (v: unknown): v is string => typeof v === "string" && /^\d{2}-\d{2}$/.test(v);
const isDays = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length > 0 && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 6);
const clean = (v: number[]) => [...new Set(v)].sort((x, y) => x - y);

/** The saved plan, or null when the days were never chosen. */
export function readPlan(): GymPlan | null {
  try {
    const saved = JSON.parse(localStorage.getItem(GYM_PLAN_KEY) ?? "null");
    if (saved && typeof saved === "object" && isDays(saved.schoolDays)) {
      return {
        schoolDays: clean(saved.schoolDays),
        summerDays: isDays(saved.summerDays) ? clean(saved.summerDays) : DEFAULT_PLAN.summerDays,
        summerFrom: isMonthDay(saved.summerFrom) ? saved.summerFrom : DEFAULT_PLAN.summerFrom,
        summerTo: isMonthDay(saved.summerTo) ? saved.summerTo : DEFAULT_PLAN.summerTo,
      };
    }
  } catch {}
  return null;
}

export function savePlan(plan: GymPlan) {
  try {
    localStorage.setItem(GYM_PLAN_KEY, JSON.stringify({ ...plan, schoolDays: clean(plan.schoolDays), summerDays: clean(plan.summerDays) }));
  } catch {}
}

/** 0 = Monday .. 6 = Sunday. */
export const weekdayIndex = (date: string) => (new Date(`${date}T12:00:00`).getDay() + 6) % 7;

/** Whether a week (given by its Monday) is a summer week. */
export function isSummerWeek(monday: string, plan: GymPlan): boolean {
  const md = addDays(monday, 3).slice(5);
  return plan.summerFrom <= plan.summerTo
    ? md >= plan.summerFrom && md <= plan.summerTo
    : md >= plan.summerFrom || md <= plan.summerTo;
}

export function daysFor(monday: string, plan: GymPlan): number[] {
  return isSummerWeek(monday, plan) ? plan.summerDays : plan.schoolDays;
}

export function targetFor(monday: string, plan: GymPlan): number {
  return daysFor(monday, plan).length;
}

/** Whether a date is one of the planned gym days of its season. */
export function isPlanned(date: string, plan: GymPlan): boolean {
  return daysFor(startOfWeek(date), plan).includes(weekdayIndex(date));
}

export function gymSet(days: Day[]): Set<string> {
  return new Set(days.filter((d) => d.gym).map((d) => d.date));
}

export interface GymStats {
  thisWeek: number;
  /** This week's target, by season. */
  target: number;
  summer: boolean;
  /** Mon..Sun, planned gym days this week. */
  planned: boolean[];
  /** Mon..Sun of this week, trained or not; null for days still ahead. */
  weekDays: (boolean | null)[];
  weekStreak: number;
  bestWeekStreak: number;
  last30: number;
  total: number;
  first: string | null;
  last: string | null;
  /** Sessions per weekday, Monday first. */
  byWeekday: number[];
  /** Days since the last session; null when there never was one. */
  sinceLast: number | null;
}

function countWeek(set: Set<string>, monday: string): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (set.has(addDays(monday, i))) n += 1;
  return n;
}

export function gymStats(days: Day[], plan: GymPlan, today = todayISO()): GymStats {
  const set = gymSet(days);
  const dates = [...set].sort();
  const monday = startOfWeek(today);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return d > today ? null : set.has(d);
  });
  const thisWeek = weekDays.filter(Boolean).length;
  const target = targetFor(monday, plan);
  const hit = (w: string) => countWeek(set, w) >= targetFor(w, plan);

  // Current streak: this week if already hit, then back week by week.
  let weekStreak = thisWeek >= target ? 1 : 0;
  for (let w = addDays(monday, -7); dates.length && w >= startOfWeek(dates[0]); w = addDays(w, -7)) {
    if (hit(w)) weekStreak += 1;
    else break;
  }

  let bestWeekStreak = 0;
  if (dates.length) {
    let run = 0;
    for (let w = startOfWeek(dates[0]); w <= monday; w = addDays(w, 7)) {
      if (hit(w)) {
        run += 1;
        bestWeekStreak = Math.max(bestWeekStreak, run);
      } else if (w !== monday) run = 0;
    }
  }

  const from30 = addDays(today, -29);
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dates) byWeekday[(new Date(`${d}T12:00:00`).getDay() + 6) % 7] += 1;

  const last = dates.at(-1) ?? null;
  return {
    thisWeek,
    target,
    summer: isSummerWeek(monday, plan),
    planned: Array.from({ length: 7 }, (_, i) => daysFor(monday, plan).includes(i)),
    weekDays,
    weekStreak,
    bestWeekStreak,
    last30: dates.filter((d) => d >= from30 && d <= today).length,
    total: dates.length,
    first: dates[0] ?? null,
    last,
    byWeekday,
    sinceLast: last ? Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${last}T12:00:00`)) / 86_400_000) : null,
  };
}

export interface GymCell {
  date: string;
  trained: boolean;
  /** The week this day sits in hit the target. */
  fullWeek: boolean;
  /** That week's target and season. */
  target: number;
  summer: boolean;
  /** One of the planned days of its season. */
  planned: boolean;
  future: boolean;
}

/**
 * Columns of weeks for the wall. Starts at the first session (or this week),
 * runs a year forward, so the empty future sits on the right and fills in.
 */
export function gymWall(
  days: Day[],
  plan: GymPlan,
  today = todayISO(),
): { weeks: GymCell[][]; months: { label: string; column: number }[] } {
  const set = gymSet(days);
  const dates = [...set].sort();
  const start = startOfWeek(dates[0] && dates[0] < today ? dates[0] : today);
  const thisMonday = startOfWeek(today);
  // At least a year on screen, and always a few weeks of future.
  let end = addDays(start, 52 * 7);
  if (end < addDays(thisMonday, 8 * 7)) end = addDays(thisMonday, 8 * 7);

  const weeks: GymCell[][] = [];
  const months: { label: string; column: number }[] = [];
  let lastMonth = -1;
  for (let w = start, col = 0; w < end; w = addDays(w, 7), col++) {
    const planDays = daysFor(w, plan);
    const target = planDays.length;
    const summer = isSummerWeek(w, plan);
    const full = countWeek(set, w) >= target;
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(w, i);
        return { date, trained: set.has(date), fullWeek: full, target, summer, planned: planDays.includes(i), future: date > today };
      }),
    );
    const m = new Date(`${w}T12:00:00`).getMonth();
    if (m !== lastMonth) {
      months.push({ label: new Date(`${w}T12:00:00`).toLocaleDateString("en-US", { month: "short" }), column: col });
      lastMonth = m;
    }
  }
  return { weeks, months };
}
