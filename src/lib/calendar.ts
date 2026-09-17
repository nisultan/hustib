import { AppData, PlanItem, Priority } from "./types";
import { addDays, toISO, fromISO } from "./dates";

/**
 * What a date holds, gathered from everywhere that has an opinion about it.
 *
 * A calendar is only worth opening if it shows the things that would ruin a
 * week when forgotten, and those live in four different collections — a task's
 * deadline, a university's, a goal's, and the blocks actually planned. Pulling
 * them together here means the month grid and the week strip agree with each
 * other and with the day.
 */

export type MarkKind = "task" | "university" | "goal";

export interface Mark {
  kind: MarkKind;
  id: string;
  label: string;
  priority: Priority;
  /** True once the thing it stands for is finished. */
  done: boolean;
}

export interface DayContents {
  date: string;
  plan: PlanItem[];
  marks: Mark[];
}

export function dayContents(data: AppData, date: string): DayContents {
  const plan = data.plan
    .filter((p) => p.date === date)
    .sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99"));

  const marks: Mark[] = [];

  for (const t of data.tasks) {
    if (t.dueDate === date) {
      marks.push({
        kind: "task",
        id: t.id,
        label: t.title,
        priority: t.priority,
        done: t.status === "completed",
      });
    }
  }

  for (const u of data.universities) {
    if (u.deadline === date) {
      marks.push({
        kind: "university",
        id: u.id,
        label: `${u.name} deadline`,
        // A university deadline is never a low-priority day, whatever the
        // application's own status says.
        priority: "urgent",
        done: u.status === "applied" || u.status === "accepted",
      });
    }
  }

  for (const g of data.goals) {
    if (g.deadline === date) {
      marks.push({
        kind: "goal",
        id: g.id,
        label: g.title,
        priority: g.priority,
        done: g.status === "achieved",
      });
    }
  }

  return { date, plan, marks };
}

/** Whether anything at all is on this day. */
export function isEmpty(day: DayContents): boolean {
  return day.plan.length === 0 && day.marks.length === 0;
}

/**
 * The Monday on or before a date.
 *
 * Monday rather than Sunday: the school week starts then, and a grid that
 * splits Saturday from Sunday puts the weekend in two different rows.
 */
export function startOfWeek(iso: string): string {
  const d = fromISO(iso);
  // getDay() is 0 for Sunday, which is six days after the Monday that owns it.
  const back = (d.getDay() + 6) % 7;
  return addDays(iso, -back);
}

export function weekOf(iso: string): string[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * The weeks a month grid needs to show that month whole.
 *
 * Always whole weeks, and never a fixed six rows: a month that fits in five
 * would otherwise carry an empty row of the next month's dates, which reads as
 * a week the student has nothing planned for.
 */
export function monthMatrix(iso: string): string[][] {
  const d = fromISO(iso);
  const first = toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const last = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));

  const weeks: string[][] = [];
  for (let cursor = startOfWeek(first); cursor <= last; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
  }
  return weeks;
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function monthLabel(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Adds months without the day-of-month overflow that breaks on the 31st. */
export function addMonths(iso: string, n: number): string {
  const d = fromISO(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toISO(target);
}
