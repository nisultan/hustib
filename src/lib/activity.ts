import { AppData, ID } from "./types";
import { addDays, fromISO, todayISO } from "./dates";
import { appliesOn } from "./habits";
import { startOfWeek } from "./calendar";
import { courseColor } from "./appearance";

/**
 * The day-by-day record of what actually got done, shaped for drawing.
 *
 * `productivity.ts` answers "how consistent am I", as one number with its
 * working out. This answers a different question — "what did the last year
 * look like" — and the answer is a shape rather than a score. The two share no
 * arithmetic on purpose: a score is a judgement and needs weights and
 * exclusions to be fair, whereas a picture of the past only has to be true.
 *
 * So there are no weights here, and today is included. A square for today that
 * fills in as the day goes is the point of a wall chart; a score that moves
 * every hour is what makes a score useless.
 */

export type Source = "tasks" | "plan" | "habits" | "reflection" | "weight";

export const SOURCES: { key: Source; label: string; color: string }[] = [
  { key: "tasks", label: "Tasks", color: "var(--accent)" },
  { key: "plan", label: "Blocks", color: "var(--medium)" },
  { key: "habits", label: "Habits", color: "var(--up)" },
  { key: "reflection", label: "Reflection", color: "var(--high)" },
  { key: "weight", label: "Weigh-ins", color: "var(--low)" },
];

export interface DayActivity {
  date: string;
  /** Everything done that day, added up. */
  total: number;
  /** The same total, split by where it came from. */
  by: Record<Source, number>;
  /**
   * 0-4, for the square's shade.
   *
   * Relative to this student's own busy days rather than to a fixed number:
   * four finished blocks is a full day for one person and a quiet morning for
   * another, and a chart that calls both "light" tells neither of them
   * anything.
   */
  level: number;
}

const EMPTY: Record<Source, number> = {
  tasks: 0,
  plan: 0,
  habits: 0,
  reflection: 0,
  weight: 0,
};

/**
 * Every day in the range, in order, including the empty ones.
 *
 * The empty days are the whole point — a heatmap is read by its gaps, and a
 * series that only carries the days something happened draws a wall of solid
 * colour that says the opposite of the truth.
 */
export function activityRange(data: AppData, from: string, to: string): DayActivity[] {
  const days = new Map(data.days.map((d) => [d.date, d]));

  // Counted once, up front. Walking `data.tasks` inside the day loop turns a
  // year of squares into 365 passes over every task the student has ever had.
  const tasksByDate = new Map<string, number>();
  for (const t of data.tasks) {
    if (t.status !== "completed" || t.completedAt == null) continue;
    tasksByDate.set(t.completedAt, (tasksByDate.get(t.completedAt) ?? 0) + 1);
  }

  const planByDate = new Map<string, number>();
  for (const p of data.plan) {
    if (!p.done) continue;
    planByDate.set(p.date, (planByDate.get(p.date) ?? 0) + 1);
  }

  const out: DayActivity[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const day = days.get(date);
    const by: Record<Source, number> = {
      ...EMPTY,
      tasks: tasksByDate.get(date) ?? 0,
      plan: planByDate.get(date) ?? 0,
      habits: day?.habitsDone.length ?? 0,
      reflection: day?.reflection.some((b) => b.text.trim() !== "") ? 1 : 0,
      weight: day?.weight != null ? 1 : 0,
    };
    const total = SOURCES.reduce((sum, s) => sum + by[s.key], 0);
    out.push({ date, total, by, level: 0 });
  }

  return shade(out);
}

/**
 * Fills in `level` from the distribution of the student's own active days.
 *
 * The busiest day is a bad yardstick on its own: one afternoon of ticking off
 * a backlog of thirty tasks would push every ordinary day down to the palest
 * shade. The 85th percentile is the top of the scale instead, so the outlier
 * saturates and the normal week keeps its range.
 */
function shade(days: DayActivity[]): DayActivity[] {
  const active = days.filter((d) => d.total > 0).map((d) => d.total);
  if (active.length === 0) return days;

  active.sort((a, b) => a - b);
  const peak = Math.max(active[Math.floor(active.length * 0.85)] ?? 1, 2);

  for (const day of days) {
    if (day.total === 0) continue;
    // Ceil, so any day with something on it is at least the first shade. A day
    // that was not empty must never look empty.
    day.level = Math.min(4, Math.ceil((day.total / peak) * 4));
  }
  return days;
}

export interface Wall {
  /** Monday-first columns, oldest week on the left. Every column has 7 rows. */
  weeks: (DayActivity | null)[][];
  days: DayActivity[];
  /** Month name and the column it starts in, for the strip above the grid. */
  months: { label: string; column: number }[];
  total: number;
  activeDays: number;
  busiest: DayActivity | null;
  /** Runs of consecutive active days, counting back from today. */
  streak: number;
  bestStreak: number;
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Recent weeks as a grid of squares, newest column first.
 *
 * Padded to whole weeks at both ends so the columns line up, with the padding
 * left as `null` rather than as zero-activity days: a Thursday that has not
 * happened yet is not a day the student failed to show up for.
 */
function firstRecorded(data: AppData): string | null {
  const dates: string[] = [];

  for (const t of data.tasks) if (t.completedAt) dates.push(t.completedAt);
  for (const p of data.plan) dates.push(p.date);
  for (const d of data.days) {
    if (d.weight != null || d.habitsDone.length > 0 || d.reflection.some((b) => b.text.trim()))
      dates.push(d.date);
  }

  return dates.length === 0 ? null : dates.reduce((a, b) => (a < b ? a : b));
}

export function wall(data: AppData, weeks = 53, today = todayISO()): Wall {
  const lastMonday = startOfWeek(today);

  /*
    Never earlier than the first thing the student ever recorded.

    Asking for a year when the hub is two months old drew ten months of empty
    squares — a wall of grey that says nothing except that the app is older
    than the record, which it is not. The window shrinks to the history that
    exists and the chart fills the width it has.
  */
  const requested = addDays(lastMonday, -(weeks - 1) * 7);
  const earliest = firstRecorded(data);
  const firstMonday =
    earliest != null && startOfWeek(earliest) > requested ? startOfWeek(earliest) : requested;

  const span =
    Math.round(
      (Date.parse(`${lastMonday}T00:00:00`) - Date.parse(`${firstMonday}T00:00:00`)) /
        604_800_000,
    ) + 1;

  const days = activityRange(data, firstMonday, addDays(lastMonday, 6));

  const columns: (DayActivity | null)[][] = [];
  for (let w = 0; w < span; w += 1) {
    const column = days.slice(w * 7, w * 7 + 7);
    columns.push(column.map((d) => (d.date > today ? null : d)));
  }

  /*
    Newest week first, so the left edge is now.

    Against the convention every contribution graph follows, and deliberately:
    this one is read to answer "how am I doing lately", and putting the answer
    at the far right of a scrolling strip means finding it before reading it.
    The oldest week trails off to the right, where it can be scrolled to by
    anyone who wants it.
  */
  columns.reverse();

  // A label goes above the column holding that month's first Monday, and only
  // when there is room for it — two labels in adjacent columns overlap into
  // something unreadable.
  const months: { label: string; column: number }[] = [];
  columns.forEach((column, i) => {
    const first = column.find((d): d is DayActivity => d != null) ?? column[0];
    if (!first) return;
    const month = fromISO(first.date).getMonth();
    const previous = months[months.length - 1];
    const label = MONTH_SHORT[month];
    if (previous?.label === label) return;
    if (previous && i - previous.column < 3) return;
    months.push({ label, column: i });
  });

  const real = days.filter((d) => d.date <= today);
  const busiest = real.reduce<DayActivity | null>(
    (best, d) => (d.total > 0 && (best == null || d.total > best.total) ? d : best),
    null,
  );

  return {
    weeks: columns,
    days: real,
    months,
    total: real.reduce((sum, d) => sum + d.total, 0),
    activeDays: real.filter((d) => d.total > 0).length,
    busiest,
    streak: streakTo(data, today),
    bestStreak: bestRun(real),
  };
}

/**
 * The run ending today, or ending yesterday if today is still blank.
 *
 * An unfinished morning should not read as a broken streak. It reads as a
 * streak that has not been extended yet, which is what it is.
 */
function streakTo(data: AppData, today: string): number {
  const window = activityRange(data, addDays(today, -400), today);
  const byDate = new Map(window.map((d) => [d.date, d.total]));

  let date = (byDate.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  let run = 0;
  while ((byDate.get(date) ?? 0) > 0) {
    run += 1;
    date = addDays(date, -1);
  }
  return run;
}

function bestRun(days: DayActivity[]): number {
  let best = 0;
  let run = 0;
  for (const day of days) {
    run = day.total > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export interface WeekBar {
  /** The Monday it starts on. */
  start: string;
  label: string;
  total: number;
  by: Record<Source, number>;
  /** True while the week is still being lived, so it is not read as a drop. */
  partial: boolean;
}

/** The same days again, added up per week, for the trend chart. */
export function weekly(days: DayActivity[], today = todayISO()): WeekBar[] {
  const bars = new Map<string, WeekBar>();

  for (const day of days) {
    const start = startOfWeek(day.date);
    let bar = bars.get(start);
    if (!bar) {
      const d = fromISO(start);
      bar = {
        start,
        label: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`,
        total: 0,
        by: { ...EMPTY },
        partial: addDays(start, 6) >= today,
      };
      bars.set(start, bar);
    }
    bar.total += day.total;
    for (const s of SOURCES) bar.by[s.key] += day.by[s.key];
  }

  return [...bars.values()].sort((a, b) => (a.start < b.start ? -1 : 1));
}

export interface Slice {
  id: ID | null;
  label: string;
  color: string;
  count: number;
}

/**
 * Finished tasks split by what they belonged to.
 *
 * Courses and categories in one list rather than two charts: a student does
 * not think of "school work" and "the rest of my life" as separate ledgers,
 * and seeing them on the same bar is the only way to notice that a fortnight
 * went entirely to one course.
 */
export function completedBy(data: AppData, from: string, to: string): Slice[] {
  const counts = new Map<string, number>();

  for (const t of data.tasks) {
    if (t.status !== "completed" || t.completedAt == null) continue;
    if (t.completedAt < from || t.completedAt > to) continue;
    const key = t.courseId ? `c:${t.courseId}` : t.categoryId ? `k:${t.categoryId}` : "none";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const slices: Slice[] = [];
  for (const [key, count] of counts) {
    if (key === "none") {
      slices.push({ id: null, label: "Unassigned", color: "var(--text-3)", count });
      continue;
    }
    const id = key.slice(2);
    const source =
      key[0] === "c"
        ? data.courses.find((c) => c.id === id)
        : data.categories.find((c) => c.id === id);
    if (!source) continue;
    slices.push({
      id,
      label: source.name,
      color: courseColor(source.color),
      count,
    });
  }

  return slices.sort((a, b) => b.count - a.count);
}

export interface HabitRow {
  id: ID;
  name: string;
  /** One entry per day in the range: kept, missed, or not due. */
  marks: ("kept" | "missed" | "off")[];
  kept: number;
  due: number;
}

/** Each habit as its own strip of squares, so a single failing one is visible. */
export function habitRows(
  data: AppData,
  from: string,
  to: string,
  today = todayISO(),
): HabitRow[] {
  const days = new Map(data.days.map((d) => [d.date, d]));

  return data.habits
    .filter((h) => h.archivedAt == null)
    .map((habit) => {
      const marks: ("kept" | "missed" | "off")[] = [];
      let kept = 0;
      let due = 0;

      for (let date = from; date <= to; date = addDays(date, 1)) {
        if (!appliesOn(habit, date)) {
          marks.push("off");
          continue;
        }
        const done = days.get(date)?.habitsDone.includes(habit.id) ?? false;
        if (done) {
          kept += 1;
          marks.push("kept");
          // A day that has not finished yet is not a miss.
        } else if (date >= today) {
          marks.push("off");
          continue;
        } else {
          marks.push("missed");
        }
        due += 1;
      }

      return { id: habit.id, name: habit.name, marks, kept, due };
    });
}
