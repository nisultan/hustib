import { AppData, Course, Day, Task, PRIORITY_RANK } from "./types";
import { courseAverage, overallAverage, trend } from "./grades";
import { daysUntil, todayISO, relativeLabel, formatDate, fromISO } from "./dates";

export type RecKind =
  | "overdue"
  | "focus"
  | "test"
  | "deadline"
  | "university"
  | "ahead"
  | "clear"
  | "declining"
  | "cluster"
  | "thin"
  | "stale"
  | "untested"
  | "momentum"
  | "journal"
  | "weight";

export interface Recommendation {
  id: string;
  kind: RecKind;
  text: string;
  /** Higher sorts first. */
  weight: number;
  /** Where the student should go to act on it. */
  href: string;
}

/**
 * Rule-based recommendations. Each rule looks at one signal, produces at most
 * one short suggestion, and the top few are shown. The value is in combining
 * signals — a weak grade plus an approaching test plus unfinished work is a
 * much stronger prompt than any of those alone, so that rule outranks the rest.
 */
export function recommend(data: AppData, limit = 4): Recommendation[] {
  const { tasks, courses, grades, universities, days } = data;
  const open = tasks.filter((t) => t.status !== "completed");
  const recs: Recommendation[] = [];

  // 1. Overdue work blocks everything else.
  const overdue = open.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0);
  if (overdue.length > 0) {
    recs.push({
      id: "overdue",
      kind: "overdue",
      weight: 100,
      href: "/tasks?view=all",
      text:
        overdue.length === 1
          ? `You have 1 overdue task — "${overdue[0].title}". Clear it before starting new low-priority work.`
          : `You have ${overdue.length} overdue tasks. Clear these before starting new low-priority work.`,
    });
  }

  // 2. The combined signal: weakest course + approaching assessment + open work.
  const weakest = weakestCourse(data);
  if (weakest) {
    const { course, avg } = weakest;
    const courseTasks = open.filter((t) => t.courseId === course.id);
    const test = nextAssessment(open, course.id);

    if (test && courseTasks.length > 0) {
      const days = test.dueDate ? daysUntil(test.dueDate) : null;
      const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
      recs.push({
        id: `focus-${course.id}`,
        kind: "focus",
        weight: 95,
        href: `/courses/${course.id}`,
        text: `Prioritize ${course.name} today. It is your lowest course at ${avg}%, "${test.title}" is ${when}, and you have ${courseTasks.length} unfinished ${plural(courseTasks.length, "task")}.`,
      });
    } else {
      recs.push({
        id: `weak-${course.id}`,
        kind: "focus",
        weight: 60,
        href: `/courses/${course.id}`,
        text: `${course.name} is your lowest grade at ${avg}%. Consider spending extra time on it this week.`,
      });
    }
  }

  // 3. Upcoming tests with unfinished work in the same course.
  for (const course of courses) {
    const test = nextAssessment(open, course.id);
    if (!test?.dueDate) continue;
    const days = daysUntil(test.dueDate);
    if (days < 0 || days > 7) continue;
    if (recs.some((r) => r.id === `focus-${course.id}`)) continue;

    const unfinished = open.filter((t) => t.courseId === course.id && t.id !== test.id).length;
    if (unfinished === 0) continue;

    recs.push({
      id: `test-${course.id}`,
      kind: "test",
      weight: 80 - days,
      href: `/courses/${course.id}`,
      text: `"${test.title}" (${course.name}) is ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}. You have ${unfinished} unfinished ${plural(unfinished, "task")} in that course.`,
    });
  }

  // 4. Cluster of high-priority work in the next 48 hours.
  const soon = open.filter((t) => {
    if (!t.dueDate) return false;
    const d = daysUntil(t.dueDate);
    return d >= 0 && d <= 2 && PRIORITY_RANK[t.priority] >= 2;
  });
  if (soon.length >= 2) {
    const closest = [...soon].sort((a, b) =>
      (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
    )[0];
    const course = courses.find((c) => c.id === closest.courseId);
    recs.push({
      id: "cluster",
      kind: "deadline",
      weight: 75,
      href: "/tasks?view=today",
      text: `You have ${soon.length} high-priority tasks due within 48 hours. Start with ${course ? course.name : `"${closest.title}"`} — it has the closest deadline.`,
    });
  }

  // 5. University deadline approaching.
  const uni = nextUniDeadline(data);
  if (uni) {
    const days = daysUntil(uni.deadline as string);
    if (days >= 0 && days <= 30) {
      recs.push({
        id: `uni-${uni.id}`,
        kind: "university",
        weight: days <= 14 ? 85 : 50,
        href: "/universities",
        text: `${uni.name} closes ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`} (${formatDate(uni.deadline as string)}) and is still marked "${uni.status}". Move it forward this week.`,
      });
    }
  }

  // 6. A light day ahead is an opening to get ahead.
  const tomorrowLoad = open.filter((t) => t.dueDate && daysUntil(t.dueDate) === 1).length;
  if (tomorrowLoad <= 1 && overdue.length === 0 && open.length > 0) {
    const biggest = busiestCourse(open, courses);
    if (biggest) {
      recs.push({
        id: "ahead",
        kind: "ahead",
        weight: 30,
        href: "/tasks?view=upcoming",
        text: `Tomorrow looks light. Consider getting ahead on ${biggest.name} — it has the most open work.`,
      });
    }
  }

  // 7. A course going the wrong way, which an average alone hides: a term
  //    that slipped from 80 to 70 still averages 75 and looks fine.
  for (const course of courses) {
    const t = trend(grades.filter((g) => g.courseId === course.id));
    if (t && t.direction === "declining" && t.delta >= 4) {
      recs.push({
        id: `declining-${course.id}`,
        kind: "declining",
        weight: 70,
        href: `/courses/${course.id}`,
        text: `${course.name} is down ${t.delta.toFixed(1)} points over the last month. Worth working out which topic is costing you before the next assessment.`,
      });
      break;
    }
  }

  // 8. Assessments bunched together. Each is manageable; three in a week is
  //    not, and now is the last point at which anything can be done about it.
  const cluster = open
    .filter((t) => t.dueDate && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7)
    .filter((t) => /\b(test|exam|quiz|assessment|mock)\b/i.test(t.title));
  if (cluster.length >= 3) {
    recs.push({
      id: "cluster",
      kind: "cluster",
      weight: 78,
      href: "/tasks?view=upcoming",
      text: `${cluster.length} assessments land in the next 7 days. Start the earliest now — this is the last week where spreading the work is still possible.`,
    });
  }

  // 9. A course with tasks but no grades has no average to reason about,
  //    which is exactly why it appears in none of the rules above.
  const untested = courses.find(
    (c) => grades.every((g) => g.courseId !== c.id) && tasks.some((t) => t.courseId === c.id),
  );
  if (untested) {
    recs.push({
      id: `untested-${untested.id}`,
      kind: "untested",
      weight: 32,
      href: "/school",
      text: `${untested.name} has no grades recorded, so it is missing from your average and from every suggestion here. Add one when a mark comes back.`,
    });
  }

  // 10. An average resting on almost nothing. Showing 93% from a single mark
  //     with the same confidence as 93% from ten is the misleading part.
  const thin = courses
    .map((c) => ({ course: c, n: grades.filter((g) => g.courseId === c.id).length }))
    .find((x) => x.n === 1);
  if (thin) {
    recs.push({
      id: `thin-${thin.course.id}`,
      kind: "thin",
      weight: 25,
      href: `/courses/${thin.course.id}`,
      text: `${thin.course.name} has one grade, so its average is really just that mark. A second makes it mean something.`,
    });
  }

  // 11. Work with no deadline ages quietly out of view, because every list in
  //     the app sorts by a date it does not have.
  const stale = open
    .filter((t) => t.dueDate == null && daysUntil(t.createdAt.slice(0, 10)) <= -14)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (stale) {
    const age = Math.abs(daysUntil(stale.createdAt.slice(0, 10)));
    recs.push({
      id: `stale-${stale.id}`,
      kind: "stale",
      weight: 35,
      href: "/tasks?view=all",
      text: `"${stale.title}" has been open ${age} days with no deadline. Give it one or drop it — it will not surface on its own.`,
    });
  }

  // 12. Momentum, measured against your own last week rather than a target.
  const doneThisWeek = completedWithin(tasks, 7);
  const doneLastWeek = completedWithin(tasks, 14) - doneThisWeek;
  if (doneThisWeek + doneLastWeek >= 4 && doneLastWeek > 0) {
    recs.push({
      id: "momentum",
      kind: "momentum",
      weight: 22,
      href: "/tasks?view=completed",
      text:
        doneThisWeek > doneLastWeek
          ? `You finished ${doneThisWeek} ${plural(doneThisWeek, "task")} this week against ${doneLastWeek} last week. Whatever changed, keep it.`
          : `You finished ${doneThisWeek} ${plural(doneThisWeek, "task")} this week against ${doneLastWeek} last week. Worth a look at what got in the way.`,
    });
  }

  // 13. The journal only works if it is kept, and the app is the only thing
  //     in a position to notice that it has not been.
  const lastWritten = days
    .filter((d) => d.reflection.some((b) => b.text.trim() !== ""))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastWritten) {
    const gap = Math.abs(daysUntil(lastWritten.date));
    if (gap >= 5) {
      recs.push({
        id: "journal-gap",
        kind: "journal",
        weight: 28,
        href: "/reflection",
        text: `Nothing in the journal for ${gap} days. A couple of lines about this week is usually enough to see the pattern later.`,
      });
    }
  }

  // 14. A weight trend needs a fortnight before it is a trend at all, which
  //     is exactly why it is worth saying once it is one.
  const shift = weightShift(days);
  if (shift) {
    recs.push({
      id: "weight-trend",
      kind: "weight",
      weight: 26,
      href: "/weight",
      text: `Your weight is ${shift.direction} ${Math.abs(shift.delta).toFixed(1)} kg over the last fortnight, measured week against week rather than day to day.`,
    });
  }

  // 7. Nothing to say is worth saying explicitly.
  if (recs.length === 0) {
    recs.push({
      id: "clear",
      kind: "clear",
      weight: 0,
      href: "/tasks",
      text:
        open.length === 0
          ? "You're all caught up. Add what's coming next so nothing slips."
          : "Nothing urgent right now. Good time to chip away at longer-term work.",
    });
  }

  return recs.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

function weakestCourse(data: AppData): { course: Course; avg: number } | null {
  const scored = data.courses
    .map((course) => ({ course, avg: courseAverage(data.grades, course.id).value }))
    .filter((x): x is { course: Course; avg: number } => x.avg != null);

  if (scored.length < 2) return null;

  const overall = overallAverage(data.grades, data.courses).value;
  const lowest = scored.reduce((a, b) => (b.avg < a.avg ? b : a));

  // Only call it out when it is meaningfully behind the rest.
  if (overall != null && overall - lowest.avg < 3) return null;
  return lowest;
}

/** The next test/exam/quiz-shaped task for a course. */
function nextAssessment(open: Task[], courseId: string): Task | null {
  const candidates = open
    .filter(
      (t) =>
        t.courseId === courseId &&
        t.dueDate != null &&
        daysUntil(t.dueDate) >= 0 &&
        // "past paper questions" is revision, not an assessment, so `paper`
        // is deliberately not in this list.
        /\b(test|exam|quiz|assessment|mock)\b/i.test(t.title),
    )
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  return candidates[0] ?? null;
}

function busiestCourse(open: Task[], courses: Course[]): Course | null {
  let best: Course | null = null;
  let bestCount = 0;
  for (const c of courses) {
    const n = open.filter((t) => t.courseId === c.id).length;
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return bestCount > 0 ? best : null;
}

export function nextUniDeadline(data: AppData) {
  const today = todayISO();
  return (
    data.universities
      .filter(
        (u) =>
          u.deadline != null &&
          u.deadline >= today &&
          !["accepted", "rejected", "applied"].includes(u.status),
      )
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))[0] ?? null
  );
}

export { relativeLabel };

/** Tasks completed within the last `days` days. */
function completedWithin(tasks: Task[], days: number): number {
  return tasks.filter((t) => t.completedAt != null && Math.abs(daysUntil(t.completedAt)) < days)
    .length;
}

/**
 * The change between this week's mean weight and the previous week's.
 *
 * Both weeks need readings, and the gap has to clear 300g — below that it is
 * inside the noise a glass of water produces, and calling it a direction
 * would be inventing the trend rather than reporting one.
 */
function weightShift(days: Day[]): { direction: "down" | "up"; delta: number } | null {
  const weighed = days.filter((d): d is Day & { weight: number } => d.weight != null);
  if (weighed.length < 4) return null;

  const now = Date.now();
  const within = (from: number, to: number) =>
    weighed.filter((d) => {
      const age = (now - fromISO(d.date).getTime()) / 86400000;
      return age >= from && age < to;
    });

  const recent = within(0, 7);
  const before = within(7, 14);
  if (recent.length === 0 || before.length === 0) return null;

  const mean = (list: typeof weighed) =>
    list.reduce((sum, d) => sum + d.weight, 0) / list.length;
  const delta = mean(recent) - mean(before);
  if (Math.abs(delta) < 0.3) return null;

  return { direction: delta < 0 ? "down" : "up", delta };
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
