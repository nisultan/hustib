import { Course, Grade } from "./types";
import { addDays, fromISO, todayISO } from "./dates";

export interface Average {
  /** Percentage 0-100, or null when there is nothing to average. */
  value: number | null;
  /** True when at least one grade carried a weight. */
  weighted: boolean;
  count: number;
  /** Sum of the weights used, for "out of X% graded so far" messaging. */
  totalWeight: number;
}

/**
 * Weighted average when weights exist, plain mean otherwise.
 *
 * Grades without a weight in an otherwise-weighted course would silently
 * vanish from a pure weighted sum, so they are each given the average weight
 * of the weighted grades instead. That keeps every grade represented.
 */
export function average(grades: Grade[]): Average {
  if (grades.length === 0) {
    return { value: null, weighted: false, count: 0, totalWeight: 0 };
  }

  const weighted = grades.filter((g) => g.weight != null && g.weight > 0);
  if (weighted.length === 0) {
    const mean = grades.reduce((s, g) => s + g.score, 0) / grades.length;
    return { value: round(mean), weighted: false, count: grades.length, totalWeight: 0 };
  }

  const fallback = weighted.reduce((s, g) => s + (g.weight as number), 0) / weighted.length;

  let num = 0;
  let den = 0;
  for (const g of grades) {
    const w = g.weight != null && g.weight > 0 ? g.weight : fallback;
    num += g.score * w;
    den += w;
  }

  return {
    value: round(num / den),
    weighted: true,
    count: grades.length,
    totalWeight: round(weighted.reduce((s, g) => s + (g.weight as number), 0)),
  };
}

export function courseAverage(grades: Grade[], courseId: string): Average {
  return average(grades.filter((g) => g.courseId === courseId));
}

/**
 * Overall average across courses. Each course counts once, so a course with
 * twenty homework grades does not outweigh one with three tests.
 */
export function overallAverage(grades: Grade[], courses: Course[]): Average {
  const perCourse = courses
    .map((c) => courseAverage(grades, c.id).value)
    .filter((v): v is number => v != null);

  if (perCourse.length === 0) {
    return { value: null, weighted: false, count: 0, totalWeight: 0 };
  }

  const mean = perCourse.reduce((s, v) => s + v, 0) / perCourse.length;
  return { value: round(mean), weighted: false, count: perCourse.length, totalWeight: 0 };
}

export type TrendDirection = "improving" | "declining" | "stable";

export interface Trend {
  direction: TrendDirection;
  /** Percentage-point change over the window. */
  delta: number;
  /** How many days the comparison window covered. */
  days: number;
}

/**
 * Compares the average of grades inside the window against everything before
 * it. Movements under half a point read as noise, so those report "stable".
 */
export function trend(grades: Grade[], days = 30): Trend | null {
  if (grades.length < 2) return null;

  const cutoff = addDays(todayISO(), -days);
  const recent = grades.filter((g) => g.date >= cutoff);
  const earlier = grades.filter((g) => g.date < cutoff);

  if (recent.length === 0 || earlier.length === 0) {
    // Not enough history on both sides of the window; fall back to comparing
    // the newer half of the grades against the older half.
    const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date));
    const mid = Math.floor(sorted.length / 2);
    const older = sorted.slice(0, mid);
    const newer = sorted.slice(mid);
    if (older.length === 0 || newer.length === 0) return null;
    return buildTrend(average(older).value, average(newer).value, days);
  }

  return buildTrend(average(earlier).value, average(recent).value, days);
}

function buildTrend(before: number | null, after: number | null, days: number): Trend | null {
  if (before == null || after == null) return null;
  const delta = round(after - before);
  const direction: TrendDirection =
    delta > 0.5 ? "improving" : delta < -0.5 ? "declining" : "stable";
  return { direction, delta, days };
}

/**
 * Projects the final grade by extending the current trend a little into the
 * remaining work. Deliberately conservative: the trend is damped to a third,
 * because a single strong test is weak evidence about a whole term.
 */
export function predictFinal(grades: Grade[]): number | null {
  const current = average(grades).value;
  if (current == null) return null;
  const t = trend(grades);
  if (!t) return current;
  return clamp(round(current + t.delta / 3));
}

/** Average after adding a hypothetical grade, for the "What if?" calculator. */
export function whatIf(grades: Grade[], score: number, weight: number | null): number | null {
  const hypothetical: Grade = {
    id: "__what_if__",
    courseId: grades[0]?.courseId ?? "",
    assessment: "Hypothetical",
    type: "Test",
    score,
    weight,
    date: todayISO(),
  };
  return average([...grades, hypothetical]).value;
}

export interface SeriesPoint {
  date: string;
  /** Running average up to and including this grade. */
  value: number;
  score: number;
  label: string;
}

/** Running-average series for the course chart. */
export function series(grades: Grade[]): SeriesPoint[] {
  const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date));
  const points: SeriesPoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const avg = average(sorted.slice(0, i + 1)).value;
    if (avg == null) continue;
    points.push({
      date: sorted[i].date,
      value: avg,
      score: sorted[i].score,
      label: sorted[i].assessment,
    });
  }
  return points;
}

/** Plain-language explanation of how an average was produced. */
export function explain(avg: Average): string {
  if (avg.value == null) return "No grades recorded yet.";
  if (avg.weighted) {
    return `Weighted average of ${avg.count} ${plural(avg.count, "grade")}, covering ${avg.totalWeight}% of the course weight.`;
  }
  return `Unweighted mean of ${avg.count} ${plural(avg.count, "grade")} — add weights to grades for a weighted average.`;
}

export function sortByDate(grades: Grade[]): Grade[] {
  return [...grades].sort((a, b) => b.date.localeCompare(a.date));
}

export function monthsCovered(grades: Grade[]): number {
  if (grades.length < 2) return 0;
  const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date));
  const first = fromISO(sorted[0].date).getTime();
  const last = fromISO(sorted[sorted.length - 1].date).getTime();
  return Math.max(1, Math.round((last - first) / (86400000 * 30)));
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
