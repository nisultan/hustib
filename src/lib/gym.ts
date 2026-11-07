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

export const GYM_TARGET_KEY = "lockin.gym.target";
export const DEFAULT_TARGET = 4;

export function readTarget(): number {
  try {
    const n = Number(localStorage.getItem(GYM_TARGET_KEY));
    return n >= 1 && n <= 7 ? n : DEFAULT_TARGET;
  } catch {
    return DEFAULT_TARGET;
  }
}

export function gymSet(days: Day[]): Set<string> {
  return new Set(days.filter((d) => d.gym).map((d) => d.date));
}

export interface GymStats {
  thisWeek: number;
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

export function gymStats(days: Day[], target: number, today = todayISO()): GymStats {
  const set = gymSet(days);
  const dates = [...set].sort();
  const monday = startOfWeek(today);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return d > today ? null : set.has(d);
  });
  const thisWeek = weekDays.filter(Boolean).length;

  // Current streak: this week if already hit, then back week by week.
  let weekStreak = thisWeek >= target ? 1 : 0;
  for (let w = addDays(monday, -7); dates.length && w >= startOfWeek(dates[0]); w = addDays(w, -7)) {
    if (countWeek(set, w) >= target) weekStreak += 1;
    else break;
  }

  let bestWeekStreak = 0;
  if (dates.length) {
    let run = 0;
    for (let w = startOfWeek(dates[0]); w <= monday; w = addDays(w, 7)) {
      if (countWeek(set, w) >= target) {
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
  future: boolean;
}

/**
 * Columns of weeks for the wall. Starts at the first session (or this week),
 * runs a year forward, so the empty future sits on the right and fills in.
 */
export function gymWall(
  days: Day[],
  target: number,
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
    const full = countWeek(set, w) >= target;
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(w, i);
        return { date, trained: set.has(date), fullWeek: full, future: date > today };
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
