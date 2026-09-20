import { AppData, ImportantKind, PlanItem, Priority, PRIORITY_RANK } from "./types";
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

export type MarkKind = "task" | "university" | "goal" | "day";

/**
 * A layer the calendar can be asked to show or hide.
 *
 * Plan blocks are a layer too, even though they are not marks: the point of
 * filtering is to answer one question at a time — "when are my exams", "what
 * did I actually schedule" — and a filter that hides deadlines but cannot hide
 * a full day of blocks does not answer either.
 */
export type Layer = MarkKind | "plan";

export const LAYERS: { id: Layer; label: string }[] = [
  { id: "day", label: "Important days" },
  { id: "task", label: "Tasks" },
  { id: "university", label: "Universities" },
  { id: "goal", label: "Goals" },
  { id: "plan", label: "Blocks" },
];

export const ALL_LAYERS: Layer[] = LAYERS.map((l) => l.id);

export interface Mark {
  kind: MarkKind;
  id: string;
  label: string;
  priority: Priority;
  /** True once the thing it stands for is finished. Never true for a day. */
  done: boolean;
  /** Only set when `kind` is "day", and chooses the glyph. */
  dayKind?: ImportantKind;
  /** Only set when `kind` is "day": which anniversary this is, from the 2nd on. */
  year?: number;
}

export interface DayContents {
  date: string;
  plan: PlanItem[];
  marks: Mark[];
}

/**
 * Whether a yearly date falls on a given day.
 *
 * Compares month and day only, and refuses dates before the first occurrence —
 * a birthday should not appear in the years before the person was born. The
 * 29th of February simply does not come round in a common year, which is the
 * honest answer rather than silently moving it to the 1st of March.
 */
function recursOn(stored: string, date: string): boolean {
  return stored.slice(5) === date.slice(5) && stored <= date;
}

export function dayContents(
  data: AppData,
  date: string,
  layers: Layer[] = ALL_LAYERS,
): DayContents {
  const showing = (layer: Layer) => layers.includes(layer);

  const plan = showing("plan")
    ? data.plan
        .filter((p) => p.date === date)
        .sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99"))
    : [];

  const marks: Mark[] = [];

  // Important days come first: they are the only entries that cannot be
  // rescheduled, and a cell that shows three blocks and hides the exam has
  // its priorities backwards.
  if (showing("day")) {
    for (const d of data.importantDays) {
      const falls = d.repeatsYearly ? recursOn(d.date, date) : d.date === date;
      if (!falls) continue;
      const year = Number(date.slice(0, 4)) - Number(d.date.slice(0, 4));
      marks.push({
        kind: "day",
        id: d.id,
        label: d.title,
        // Not a to-do, so it has no priority of its own; "high" is what makes
        // it read as something that matters without shouting over a deadline.
        priority: "high",
        done: false,
        dayKind: d.kind,
        year: d.repeatsYearly && year > 0 ? year : undefined,
      });
    }
  }

  if (showing("task")) {
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
  }

  if (showing("university")) {
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
  }

  if (showing("goal")) {
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

/**
 * What is coming, soonest first, across everything that carries a date.
 *
 * The dashboard's question is "what is closest", and until now that could only
 * be answered one collection at a time — the tasks list knew nothing about the
 * SAT, and the calendar knew about it only if you were already looking at
 * September. Merging them is the whole point: a deadline three days out
 * matters the same amount whether it came from a task or a birthday.
 */
export interface Upcoming {
  kind: MarkKind;
  id: string;
  label: string;
  /** The resolved date — for a yearly day, its next occurrence. */
  date: string;
  daysLeft: number;
  priority: Priority;
  dayKind?: ImportantKind;
  /** Which anniversary the next occurrence will be, when that is knowable. */
  year?: number;
}

/**
 * When a yearly day next comes round, counting today as still ahead.
 *
 * A birthday is not "passed" on the morning of, so today always resolves to
 * today. February 29th only resolves in a leap year, which is the honest
 * answer rather than quietly moving it.
 */
export function nextOccurrence(stored: string, from: string): string | null {
  const [, month, day] = stored.split("-");
  for (let year = Number(from.slice(0, 4)); year <= Number(from.slice(0, 4)) + 4; year += 1) {
    const candidate = `${year}-${month}-${day}`;
    // Rejects the 29th in a common year: the Date would roll into March.
    const real = new Date(`${candidate}T12:00:00`);
    if (toISO(real) !== candidate) continue;
    if (candidate >= from) return candidate;
  }
  return null;
}

export function upcoming(
  data: AppData,
  from: string,
  {
    within = 120,
    limit = 8,
    layers = ALL_LAYERS,
  }: { within?: number; limit?: number; layers?: Layer[] } = {},
): Upcoming[] {
  const showing = (layer: Layer) => layers.includes(layer);
  const horizon = addDays(from, within);
  const out: Upcoming[] = [];

  const push = (entry: Omit<Upcoming, "daysLeft">) => {
    if (entry.date < from || entry.date > horizon) return;
    out.push({ ...entry, daysLeft: daysBetween(from, entry.date) });
  };

  if (showing("day")) {
    for (const d of data.importantDays) {
      const date = d.repeatsYearly ? nextOccurrence(d.date, from) : d.date;
      if (!date) continue;
      const year = Number(date.slice(0, 4)) - Number(d.date.slice(0, 4));
      push({
        kind: "day",
        id: d.id,
        label: d.title,
        date,
        priority: "high",
        dayKind: d.kind,
        year: d.repeatsYearly && year > 0 ? year : undefined,
      });
    }
  }

  if (showing("task")) {
    for (const t of data.tasks) {
      // Finished work is not coming up, however close its deadline was.
      if (t.status === "completed" || t.dueDate == null) continue;
      push({ kind: "task", id: t.id, label: t.title, date: t.dueDate, priority: t.priority });
    }
  }

  if (showing("university")) {
    for (const u of data.universities) {
      if (u.deadline == null) continue;
      if (u.status === "applied" || u.status === "accepted" || u.status === "rejected")
        continue;
      push({
        kind: "university",
        id: u.id,
        label: `${u.name} — ${u.program || "application"}`,
        date: u.deadline,
        priority: "urgent",
      });
    }
  }

  if (showing("goal")) {
    for (const g of data.goals) {
      if (g.deadline == null || g.status !== "active") continue;
      push({ kind: "goal", id: g.id, label: g.title, date: g.deadline, priority: g.priority });
    }
  }

  return out
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
    )
    .slice(0, limit);
}

/** Whole days from one date to another, both as "YYYY-MM-DD". */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000,
  );
}
