import { AppData, Course, Task, PRIORITY_RANK } from "./types";
import { courseAverage, overallAverage } from "./grades";
import { daysUntil, todayISO, relativeLabel, formatDate } from "./dates";

export type RecKind =
  "overdue" | "focus" | "test" | "deadline" | "university" | "ahead" | "clear";

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
  const { tasks, courses, grades, universities } = data;
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

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
