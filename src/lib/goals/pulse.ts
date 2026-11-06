import { addDays, todayISO } from "../dates";
import { extrasOf, Goal, GoalExtras } from "../types";

/**
 * What keeps a goal alive between visits: pace against the clock, how long
 * since you last touched it, a streak of days you pushed, and the reasons you
 * wrote down, handed back one at a time.
 */

export interface Pace {
  /** Share of the time between setting the goal and its deadline already gone, 0–1. */
  time: number;
  /** Progress, 0–1, or null when untracked. */
  done: number | null;
  verdict: "ahead" | "on track" | "behind" | "way behind" | null;
}

export function paceOf(goal: Goal, progress: number | null, now = Date.now()): Pace | null {
  if (!goal.deadline || goal.status === "achieved") return null;
  const start = new Date(`${goal.createdAt}T00:00:00`).getTime();
  const end = new Date(`${goal.deadline}T23:59:59`).getTime();
  const time = end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 1;
  const done = progress == null ? null : Math.min(1, Math.max(0, progress / 100));
  let verdict: Pace["verdict"] = null;
  if (done != null) {
    const gap = done - time;
    verdict = gap >= 0.08 ? "ahead" : gap >= -0.08 ? "on track" : gap >= -0.3 ? "behind" : "way behind";
  }
  return { time, done, verdict };
}

/** The last day anything happened on this goal. */
export function lastTouched(goal: Goal, ex: GoalExtras = extrasOf(goal)): string {
  const dates = [goal.createdAt, ...ex.pushes, ...ex.milestones.map((m) => m.doneAt ?? "")].filter(Boolean);
  return dates.sort().at(-1) ?? goal.createdAt;
}

export function daysSince(date: string, today = todayISO()): number {
  return Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000);
}

/** Days in a row, ending today or yesterday, that you pushed. */
export function pushStreak(pushes: string[], today = todayISO()): number {
  const set = new Set(pushes);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

export interface Reminder {
  label: string;
  text: string;
  tone: "why" | "reward" | "cost" | "mantra";
}

/** The reasons you wrote, in the order worth reading them. */
export function remindersOf(goal: Goal, ex: GoalExtras = extrasOf(goal)): Reminder[] {
  const out: Reminder[] = [];
  if (goal.note.trim()) out.push({ label: "Why it matters", text: goal.note.trim(), tone: "why" });
  if (ex.reward.trim()) out.push({ label: "When you get there", text: ex.reward.trim(), tone: "reward" });
  if (ex.cost.trim()) out.push({ label: "If you let it go", text: ex.cost.trim(), tone: "cost" });
  if (ex.mantra.trim()) out.push({ label: "Your line", text: ex.mantra.trim(), tone: "mantra" });
  return out;
}

/** All pictures, cover first. */
export function picturesOf(goal: Goal, ex: GoalExtras = extrasOf(goal)): string[] {
  return [goal.image, ...ex.gallery].filter((x): x is string => !!x);
}

/**
 * Which goal gets the spotlight today. Neglect and a near deadline raise a
 * goal's chances; the day picks among them, so it changes daily but not on
 * every reload.
 */
export function spotlight(goals: Goal[], today = todayISO()): Goal[] {
  const live = goals.filter((g) => g.status === "active");
  const weight = (g: Goal) => {
    const quiet = Math.min(14, daysSince(lastTouched(g), today));
    const due = g.deadline ? Math.max(0, 60 - daysSince(today, g.deadline)) / 60 : 0;
    const pr = { urgent: 1.6, high: 1.3, medium: 1, low: 0.7 }[g.priority];
    return (1 + quiet / 7 + due) * pr;
  };
  const seed = Math.floor(new Date(`${today}T12:00:00`).getTime() / 86_400_000);
  const rand = (i: number) => {
    const x = Math.sin((seed + 1) * 9301 + i * 49297) * 233280;
    return x - Math.floor(x);
  };
  return live
    .map((g, i) => ({ g, k: Math.pow(rand(i), 1 / weight(g)) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.g);
}

export function isUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}
