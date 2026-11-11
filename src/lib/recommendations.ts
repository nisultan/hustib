import { AppData, Course, Day, Task, PRIORITY_RANK } from "./types";
import { courseAverage, overallAverage, trend } from "./grades";
import { daysUntil, todayISO, relativeLabel, formatDate, fromISO } from "./dates";
import { habitPatterns, weekdayNames } from "./consistency";
import { gymStats, readPlan, DEFAULT_PLAN } from "./gym";
import { nextOccurrence } from "./calendar";

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
  | "weight"
  | "gym"
  | "habit"
  | "birthday"
  | "event";

/** Which part of life a suggestion is about, for grouping and filtering. */
export type RecArea = "school" | "body" | "habits" | "life";

export const AREA_LABEL: Record<RecArea, string> = {
  school: "School",
  body: "Body",
  habits: "Habits",
  life: "Life",
};

export interface Recommendation {
  id: string;
  kind: RecKind;
  area: RecArea;
  /** The move, short and imperative: "Clear 3 overdue tasks". */
  title: string;
  /** Why, in a sentence or two. */
  text: string;
  /** The numbers behind it, shown as small facts. */
  facts?: string[];
  /** Label of the button that acts on it. */
  action: string;
  /** Higher sorts first. */
  weight: number;
  /** Where the student should go to act on it. */
  href: string;
}

const AREA_OF: Record<RecKind, RecArea> = {
  overdue: "school",
  focus: "school",
  test: "school",
  deadline: "school",
  university: "school",
  ahead: "school",
  clear: "school",
  declining: "school",
  cluster: "school",
  thin: "school",
  stale: "school",
  untested: "school",
  momentum: "school",
  journal: "habits",
  weight: "body",
  gym: "body",
  habit: "habits",
  birthday: "life",
  event: "life",
};

type Draft = Omit<Recommendation, "area">;

const when = (days: number) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

/**
 * Rule-based recommendations. Each rule looks at one signal and produces at
 * most one suggestion; the strongest come first. The value is in combining
 * signals — a weak grade plus an approaching test plus unfinished work is a
 * much stronger prompt than any of those alone, so that rule outranks the rest.
 */
export function recommend(data: AppData, limit = 12): Recommendation[] {
  const { tasks, courses, grades, days } = data;
  const today = todayISO();
  const open = tasks.filter((t) => t.status !== "completed");
  const recs: Draft[] = [];

  // 1. Overdue work blocks everything else.
  const overdue = open.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0);
  if (overdue.length > 0) {
    const oldest = [...overdue].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
    recs.push({
      id: "overdue",
      kind: "overdue",
      weight: 100,
      href: "/tasks?view=all",
      action: "Open overdue",
      title: overdue.length === 1 ? `Finish "${oldest.title}"` : `Clear ${overdue.length} overdue tasks`,
      text:
        overdue.length === 1
          ? "It is past its deadline. Get it off the list before starting anything new."
          : `Start with "${oldest.title}" — it has been late the longest. New low-priority work can wait until these are gone.`,
      facts: [`${overdue.length} late`, `oldest ${Math.abs(daysUntil(oldest.dueDate!))}d overdue`],
    });
  }

  // 2. The combined signal: weakest course + approaching assessment + open work.
  const weakest = weakestCourse(data);
  if (weakest) {
    const { course, avg } = weakest;
    const courseTasks = open.filter((t) => t.courseId === course.id);
    const test = nextAssessment(open, course.id);

    if (test && courseTasks.length > 0) {
      const d = test.dueDate ? daysUntil(test.dueDate) : 0;
      recs.push({
        id: `focus-${course.id}`,
        kind: "focus",
        weight: 95,
        href: `/courses/${course.id}`,
        action: `Open ${course.name}`,
        title: `Make today a ${course.name} day`,
        text: `It is your lowest course, "${test.title}" is ${when(d)}, and there is still unfinished work in it. Those three together beat anything else on the list.`,
        facts: [`${avg}% average`, `test ${when(d)}`, `${courseTasks.length} open ${plural(courseTasks.length, "task")}`],
      });
    } else {
      recs.push({
        id: `weak-${course.id}`,
        kind: "focus",
        weight: 60,
        href: `/courses/${course.id}`,
        action: `Open ${course.name}`,
        title: `Give ${course.name} extra time this week`,
        text: "It sits clearly below your other courses. An extra hour now is cheaper than a rescue before the exam.",
        facts: [`${avg}% average`],
      });
    }
  }

  // 3. Upcoming tests with unfinished work in the same course.
  for (const course of courses) {
    const test = nextAssessment(open, course.id);
    if (!test?.dueDate) continue;
    const d = daysUntil(test.dueDate);
    if (d < 0 || d > 7) continue;
    if (recs.some((r) => r.id === `focus-${course.id}`)) continue;
    const unfinished = open.filter((t) => t.courseId === course.id && t.id !== test.id).length;
    if (unfinished === 0) continue;
    recs.push({
      id: `test-${course.id}`,
      kind: "test",
      weight: 80 - d,
      href: `/courses/${course.id}`,
      action: "See the work",
      title: `Prepare for "${test.title}"`,
      text: `${course.name} has a test ${when(d)} and work still open in the same course. Finish that first — it is usually the revision.`,
      facts: [when(d), `${unfinished} open in ${course.name}`],
    });
  }

  // 4. Cluster of high-priority work in the next 48 hours.
  const soon = open.filter((t) => {
    if (!t.dueDate) return false;
    const d = daysUntil(t.dueDate);
    return d >= 0 && d <= 2 && PRIORITY_RANK[t.priority] >= 2;
  });
  if (soon.length >= 2) {
    const closest = [...soon].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
    recs.push({
      id: "crunch",
      kind: "deadline",
      weight: 75,
      href: "/tasks?view=today",
      action: "Open today",
      title: `${soon.length} important deadlines in 48 hours`,
      text: `Start with "${closest.title}" — it is due first. Block the time now, before the day fills itself.`,
      facts: [`${soon.length} high priority`, `first ${relativeLabel(closest.dueDate!).toLowerCase()}`],
    });
  }

  // 5. University deadline approaching.
  const uni = nextUniDeadline(data);
  if (uni?.deadline) {
    const d = daysUntil(uni.deadline);
    if (d <= 30) {
      recs.push({
        id: `uni-${uni.id}`,
        kind: "university",
        weight: d <= 7 ? 88 : 55,
        href: "/",
        action: "Open applications",
        title: `${uni.name} application closes ${when(d)}`,
        text:
          d <= 7
            ? "This is the last week. Finish what is missing today and leave the final days for checking."
            : "There is still time to do it well. Write down what is missing so it does not all land in the last week.",
        facts: [formatDate(uni.deadline), uni.status],
      });
    }
  }

  // 6. Assessments bunched together.
  const exams = open
    .filter((t) => t.dueDate && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7)
    .filter((t) => /\b(test|exam|quiz|assessment|mock)\b/i.test(t.title));
  if (exams.length >= 3) {
    recs.push({
      id: "cluster",
      kind: "cluster",
      weight: 78,
      href: "/tasks?view=upcoming",
      action: "See the week",
      title: `${exams.length} assessments this week`,
      text: "Each one is manageable; together they are not. Start the earliest now — this is the last point where spreading the work still works.",
      facts: exams.slice(0, 3).map((t) => `${t.title} · ${relativeLabel(t.dueDate!).toLowerCase()}`),
    });
  }

  // 7. A course going the wrong way, which an average alone hides.
  for (const course of courses) {
    const t = trend(grades.filter((g) => g.courseId === course.id));
    if (t && t.direction === "declining" && t.delta >= 4) {
      recs.push({
        id: `declining-${course.id}`,
        kind: "declining",
        weight: 70,
        href: `/courses/${course.id}`,
        action: `Open ${course.name}`,
        title: `${course.name} is sliding`,
        text: "The average still looks fine, but the recent marks are lower. Find the topic that is costing you before the next assessment.",
        facts: [`down ${t.delta.toFixed(1)} pts this month`],
      });
      break;
    }
  }

  // 8. Gym: behind the week's target with too few days left to be relaxed.
  const plan = readPlanSafe();
  const gym = gymStats(days, plan, today);
  if (gym.total > 0 || plan !== DEFAULT_PLAN) {
    const left = gym.target - gym.thisWeek;
    const daysLeft = gym.weekDays.filter((d) => d === null).length + (gym.weekDays[(fromISO(today).getDay() + 6) % 7] ? 0 : 1);
    if (left > 0 && daysLeft > 0) {
      const tight = left >= daysLeft;
      recs.push({
        id: "gym-week",
        kind: "gym",
        weight: tight ? 72 : left >= daysLeft - 1 ? 50 : 20,
        href: "/gym",
        action: "Open gym",
        title: tight ? `Gym today, or the week is gone` : `${left} more ${plural(left, "session")} this week`,
        text: tight
          ? `${left} ${plural(left, "session")} still needed and only ${daysLeft} ${plural(daysLeft, "day")} left in the week. Every day from here counts.`
          : `You are at ${gym.thisWeek} of ${gym.target}. Plenty of room — just do not leave it all for Sunday.`,
        facts: [`${gym.thisWeek}/${gym.target} this week`, gym.weekStreak > 0 ? `${gym.weekStreak}-week streak at stake` : `${daysLeft} days left`],
      });
    } else if (left <= 0 && gym.weekStreak >= 2) {
      recs.push({
        id: "gym-done",
        kind: "gym",
        weight: 15,
        href: "/gym",
        action: "See the wall",
        title: "Gym week done",
        text: `That is ${gym.weekStreak} full weeks in a row. Anything more this week is a bonus, and rest counts too.`,
        facts: [`${gym.thisWeek}/${gym.target}`, `${gym.weekStreak} weeks`],
      });
    }
  }

  // 9. Habits going the wrong way.
  const habits = habitPatterns(data, today).filter((h) => h.recent != null);
  const sliding = habits
    .filter((h) => h.trend === "down" || (h.recent ?? 1) < 0.4)
    .sort((a, b) => (a.recent ?? 0) - (b.recent ?? 0))[0];
  if (sliding) {
    const pct = Math.round((sliding.recent ?? 0) * 100);
    recs.push({
      id: `habit-${sliding.id}`,
      kind: "habit",
      weight: 45,
      href: "/",
      action: "Open habits",
      title: `Rescue "${sliding.name}"`,
      text:
        sliding.weakDays.length > 0
          ? `It keeps dying on ${weekdayNames(sliding.weakDays)}. Make those days easier — a smaller version still counts.`
          : "It has been slipping for two weeks. Shrink it until it is too small to skip, then build back up.",
      facts: [`${pct}% kept`, sliding.lastKept == null ? "never kept" : `last kept ${sliding.lastKept}d ago`],
    });
  }
  const strong = habits.filter((h) => h.streak >= 7).sort((a, b) => b.streak - a.streak)[0];
  if (strong) {
    recs.push({
      id: `streak-${strong.id}`,
      kind: "habit",
      weight: 12,
      href: "/",
      action: "Keep it going",
      title: `${strong.streak} days of "${strong.name}"`,
      text: "That is now a habit, not an effort. Protect the streak on busy days with the smallest possible version.",
      facts: [`${strong.streak}-day streak`],
    });
  }

  // 10. Birthdays and important days coming up.
  for (const d of data.importantDays) {
    const date = d.repeatsYearly ? nextOccurrence(d.date, today) : d.date;
    if (!date || date < today) continue;
    const left = daysUntil(date);
    if (d.kind === "birthday" && left <= 10) {
      const who = d.title.replace(/[’']s\s+birthday.*$/i, "").replace(/birthday/i, "").trim() || d.title;
      const mine = /^my\b/i.test(d.title.trim());
      if (mine) continue;
      recs.push({
        id: `bday-${d.id}`,
        kind: "birthday",
        weight: left <= 2 ? 82 : 40,
        href: "/",
        action: "See the date",
        title: left === 0 ? `It's ${who}'s birthday today` : `${who}'s birthday ${when(left)}`,
        text: left <= 2 ? "Message them today. If there is a gift, it needs sorting now." : "Enough time to think of something good instead of something last-minute.",
        facts: [formatDate(date)],
      });
    } else if (d.kind === "exam" && left <= 21) {
      recs.push({
        id: `exam-${d.id}`,
        kind: "event",
        weight: left <= 3 ? 85 : left <= 10 ? 58 : 34,
        href: "/",
        action: "Plan revision",
        title: `${d.title} ${when(left)}`,
        text: left <= 3 ? "Final stretch: past papers and sleep beat new material now." : "Split what is left into daily chunks while there are still enough days to split it into.",
        facts: [formatDate(date), `${left} ${plural(left, "day")}`],
      });
    }
  }

  // 11. A light day ahead is an opening to get ahead.
  const tomorrowLoad = open.filter((t) => t.dueDate && daysUntil(t.dueDate) === 1).length;
  if (tomorrowLoad <= 1 && overdue.length === 0 && open.length > 0) {
    const biggest = busiestCourse(open, courses);
    if (biggest) {
      recs.push({
        id: "ahead",
        kind: "ahead",
        weight: 30,
        href: "/tasks?view=upcoming",
        action: "See upcoming",
        title: `Get ahead on ${biggest.name}`,
        text: "Tomorrow looks light and this course has the most open work. An hour today is a calmer week.",
        facts: [`${open.filter((t) => t.courseId === biggest.id).length} open`],
      });
    }
  }

  // 12. A course with tasks but no grades has no average to reason about.
  const untested = courses.find(
    (c) => grades.every((g) => g.courseId !== c.id) && tasks.some((t) => t.courseId === c.id),
  );
  if (untested) {
    recs.push({
      id: `untested-${untested.id}`,
      kind: "untested",
      weight: 18,
      href: "/courses",
      action: "Add a grade",
      title: `Log a grade for ${untested.name}`,
      text: "With no marks it is missing from your average and from every suggestion here.",
    });
  }

  // 13. An average resting on a single mark.
  const thin = courses
    .map((c) => ({ course: c, n: grades.filter((g) => g.courseId === c.id).length }))
    .find((x) => x.n === 1);
  if (thin) {
    recs.push({
      id: `thin-${thin.course.id}`,
      kind: "thin",
      weight: 14,
      href: `/courses/${thin.course.id}`,
      action: "Add a grade",
      title: `${thin.course.name} rests on one mark`,
      text: "Its average is really just that single grade. A second one makes it mean something.",
    });
  }

  // 14. Work with no deadline ages quietly out of view.
  const stale = open
    .filter((t) => t.dueDate == null && daysUntil(t.createdAt.slice(0, 10)) <= -14)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (stale) {
    const age = Math.abs(daysUntil(stale.createdAt.slice(0, 10)));
    recs.push({
      id: `stale-${stale.id}`,
      kind: "stale",
      weight: 24,
      href: "/tasks?view=all",
      action: "Open tasks",
      title: `Decide on "${stale.title}"`,
      text: "It has no deadline, so it will never surface on its own. Give it a date or delete it.",
      facts: [`open ${age} days`],
    });
  }

  // 15. Momentum, measured against your own last week.
  const doneThisWeek = completedWithin(tasks, 7);
  const doneLastWeek = completedWithin(tasks, 14) - doneThisWeek;
  if (doneThisWeek + doneLastWeek >= 4 && doneLastWeek > 0) {
    const up = doneThisWeek > doneLastWeek;
    recs.push({
      id: "momentum",
      kind: "momentum",
      weight: up ? 16 : 36,
      href: "/tasks?view=completed",
      action: "See what got done",
      title: up ? "Your best week lately" : "This week is slower",
      text: up
        ? "Whatever changed this week, keep it."
        : "Worth a look at what got in the way — it is usually one thing, not everything.",
      facts: [`${doneThisWeek} this week`, `${doneLastWeek} last week`],
    });
  }

  // 16. The journal only works if it is kept.
  const lastWritten = days
    .filter((d) => d.reflection.some((b) => b.text.trim() !== ""))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastWritten) {
    const gap = Math.abs(daysUntil(lastWritten.date));
    if (gap >= 4) {
      recs.push({
        id: "journal-gap",
        kind: "journal",
        weight: 28,
        href: "/reflection",
        action: "Write tonight",
        title: "Write a few lines tonight",
        text: "A couple of sentences about this week is enough to see the pattern later. Today's questions make it quick.",
        facts: [`${gap} days since the last entry`],
      });
    }
  }

  // 17. A weight trend, once it is one.
  const shift = weightShift(days);
  if (shift) {
    recs.push({
      id: "weight-trend",
      kind: "weight",
      weight: 26,
      href: "/gym",
      action: "See the trend",
      title: `Weight ${shift.direction} ${Math.abs(shift.delta).toFixed(1)} kg`,
      text: "Measured week against week rather than day to day, so it is a real direction, not a glass of water.",
      facts: ["last 14 days"],
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "clear",
      kind: "clear",
      weight: 0,
      href: "/tasks",
      action: "Open tasks",
      title: open.length === 0 ? "All caught up" : "Nothing urgent",
      text:
        open.length === 0
          ? "Add what is coming next so nothing slips."
          : "A good moment to chip away at longer-term work.",
    });
  }

  return recs
    .map((r) => ({ ...r, area: AREA_OF[r.kind] }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

function readPlanSafe() {
  try {
    return readPlan() ?? DEFAULT_PLAN;
  } catch {
    return DEFAULT_PLAN;
  }
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
