import { AppData, Habit, ID } from "./types";
import { addDays } from "./dates";
import { appliesOn, streakOf, weekdayOf } from "./habits";

/**
 * What someone actually keeps, and where it falls apart.
 *
 * The rest of the app already knows the totals — a streak, a keep-rate, a
 * score. Totals answer "how am I doing" and nothing after it. The questions a
 * friend would ask are shaped differently: is this getting better or worse,
 * which days does it die on, which part of the planned day never happens.
 * Those are what this file computes, once, for everything that wants to say
 * something about consistency: the assistant's context, the check-in that
 * decides what to ask, and the page that draws it.
 *
 * Today is excluded from every rate. A day still being lived is not a missed
 * day, and counting it as one makes every habit look worse at breakfast than
 * it does at midnight.
 */

const WINDOW = 28;
const HALF = 14;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface HabitPattern {
  id: ID;
  name: string;
  streak: number;
  /** Over the last four weeks, not counting today. */
  kept: number;
  due: number;
  /** Keep-rate over the last fortnight, 0-1, or null if it was never due. */
  recent: number | null;
  /** The fortnight before that, for the trend. */
  before: number | null;
  /** "up", "down" or "flat" — only when both halves had enough days to say. */
  trend: "up" | "down" | "flat" | null;
  /** Weekdays it reliably dies on, as 0-6. */
  weakDays: number[];
  /** Days since it was last kept, or null if never. */
  lastKept: number | null;
  dueToday: boolean;
  doneToday: boolean;
}

export function habitPatterns(data: AppData, today: string): HabitPattern[] {
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const kept = (h: Habit, date: string) => byDate.get(date)?.habitsDone.includes(h.id) ?? false;

  return data.habits
    .filter((h) => h.archivedAt == null)
    .map((h) => {
      let k = 0;
      let due = 0;
      const halves = [
        { kept: 0, due: 0 },
        { kept: 0, due: 0 },
      ];
      const missByDay = new Array(7).fill(0);
      const dueByDay = new Array(7).fill(0);

      for (let i = 1; i <= WINDOW; i += 1) {
        const date = addDays(today, -i);
        if (!appliesOn(h, date)) continue;
        const done = kept(h, date);
        due += 1;
        if (done) k += 1;
        const half = halves[i <= HALF ? 0 : 1];
        half.due += 1;
        if (done) half.kept += 1;
        const wd = weekdayOf(date);
        dueByDay[wd] += 1;
        if (!done) missByDay[wd] += 1;
      }

      const rate = (x: { kept: number; due: number }) => (x.due === 0 ? null : x.kept / x.due);
      const recent = rate(halves[0]);
      const before = rate(halves[1]);

      // A trend needs a few days on each side, and a real difference. Three
      // days against four is noise with an arrow drawn on it.
      let trend: HabitPattern["trend"] = null;
      if (recent != null && before != null && halves[0].due >= 4 && halves[1].due >= 4) {
        const delta = recent - before;
        trend = delta > 0.15 ? "up" : delta < -0.15 ? "down" : "flat";
      }

      /*
        A weekday is weak when it is missed most of the time while the habit
        mostly holds elsewhere. A habit missed every day has no weak day — it
        has a different problem, and naming Friday would be a false diagnosis.
      */
      const overall = due === 0 ? 0 : k / due;
      const weakDays =
        overall < 0.35
          ? []
          : dueByDay
              .map((n, wd) => ({ wd, n, miss: n === 0 ? 0 : missByDay[wd] / n }))
              .filter((d) => d.n >= 2 && d.miss >= 0.67 && d.miss - (1 - overall) >= 0.25)
              .map((d) => d.wd);

      let lastKept: number | null = null;
      for (let i = 0; i < 400; i += 1) {
        const date = addDays(today, -i);
        if (date < h.createdAt.slice(0, 10)) break;
        if (kept(h, date)) {
          lastKept = i;
          break;
        }
      }

      return {
        id: h.id,
        name: h.name,
        streak: streakOf(h, byDate, today),
        kept: k,
        due,
        recent,
        before,
        trend,
        weakDays,
        lastKept,
        dueToday: appliesOn(h, today),
        doneToday: kept(h, today),
      };
    });
}

export interface PlanSlice {
  label: string;
  planned: number;
  done: number;
}

export interface PlanPattern {
  /** Over the last fortnight, not counting today. */
  planned: number;
  done: number;
  /** Morning / afternoon / evening / no time, in that order, empty ones dropped. */
  byPart: PlanSlice[];
  /** By category, biggest first. */
  byCategory: PlanSlice[];
}

/**
 * How much of the planned day actually happens.
 *
 * Split by time of day because that is where plans usually break — the
 * morning holds and the evening is fiction — and someone can do something
 * about "your evenings" in a way they cannot about "64%".
 */
export function planPatterns(data: AppData, today: string): PlanPattern {
  const from = addDays(today, -HALF);
  const recent = data.plan.filter((p) => p.date >= from && p.date < today);

  const part = (start: string | null) => {
    if (start == null) return "no set time";
    const h = Number(start.slice(0, 2));
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  };

  const tally = (key: (p: (typeof recent)[number]) => string) => {
    const m = new Map<string, PlanSlice>();
    for (const p of recent) {
      const label = key(p);
      const s = m.get(label) ?? { label, planned: 0, done: 0 };
      s.planned += 1;
      if (p.done) s.done += 1;
      m.set(label, s);
    }
    return m;
  };

  const parts = tally((p) => part(p.start));
  const byPart = ["morning", "afternoon", "evening", "no set time"]
    .map((l) => parts.get(l))
    .filter((s): s is PlanSlice => s != null);

  const byCategory = [
    ...tally((p) => data.categories.find((c) => c.id === p.categoryId)?.name ?? "Uncategorised").values(),
  ].sort((a, b) => b.planned - a.planned);

  return {
    planned: recent.length,
    done: recent.filter((p) => p.done).length,
    byPart,
    byCategory,
  };
}

/** "Fri, Sat" — for prose. */
export function weekdayNames(days: number[]): string {
  return days.map((d) => WEEKDAY[d]).join(", ");
}

export function pct(n: number | null): string {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}
