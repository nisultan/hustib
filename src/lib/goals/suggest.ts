import { AppData, ID } from "@/lib/types";
import { GoalSource, GoalTracker } from "./tracker";

/**
 * The client half of the one AI call a goal ever costs.
 *
 * Builds a compact inventory of what this hub can measure, asks the route to
 * pick from it, and translates the answer back into real ids. Nothing the model
 * returns is trusted: handles it did not receive are dropped, the source is
 * checked against the union, and a target outside anything sensible is clamped.
 * A bad spec is worse than no spec, because it draws a confident bar over a
 * number that means nothing.
 */

const SOURCES: GoalSource[] = ["habits", "tasks", "plan", "journal", "weight"];

interface Handles {
  text: string;
  habits: Map<string, ID>;
  courses: Map<string, ID>;
  categories: Map<string, ID>;
}

/**
 * What the hub can measure, in as few tokens as it can be said in.
 *
 * Only live things: an archived habit cannot be the evidence for a new goal,
 * and offering it invites a spec that can never move.
 */
function inventory(data: AppData): Handles {
  const habits = new Map<string, ID>();
  const courses = new Map<string, ID>();
  const categories = new Map<string, ID>();
  const lines: string[] = [];

  const live = data.habits.filter((h) => h.archivedAt == null);
  if (live.length > 0) {
    lines.push("Habits:");
    live.forEach((h, i) => {
      const handle = `H${i + 1}`;
      habits.set(handle, h.id);
      lines.push(`  ${handle} ${h.name}`);
    });
  }

  if (data.courses.length > 0) {
    lines.push("School subjects:");
    data.courses.forEach((c, i) => {
      const handle = `S${i + 1}`;
      courses.set(handle, c.id);
      lines.push(`  ${handle} ${c.name}`);
    });
  }

  if (data.categories.length > 0) {
    lines.push("Categories:");
    data.categories.forEach((c, i) => {
      const handle = `C${i + 1}`;
      categories.set(handle, c.id);
      lines.push(`  ${handle} ${c.name}`);
    });
  }

  // Two numbers rather than the weight history: the model only needs to know
  // whether weighing happens at all, and what the current figure is, to set a
  // target that is not absurd.
  const weights = data.days.filter((d) => d.weight != null);
  lines.push(
    weights.length > 0
      ? `Weight: recorded ${weights.length} times, latest ${weights[0]?.weight} kg`
      : "Weight: never recorded",
  );

  const written = data.days.filter((d) => d.reflection.some((b) => b.text.trim() !== "")).length;
  lines.push(`Journal: ${written} days written`);
  lines.push(`Planner: ${data.plan.length} blocks, ${data.tasks.length} school tasks`);

  return { text: lines.join("\n"), habits, courses, categories };
}

export interface Suggestion {
  tracker: GoalTracker | null;
  /** Set when the model declined, with its reason if it gave one. */
  declined: boolean;
}

function ids(raw: unknown, map: Map<string, ID>): ID[] {
  if (!Array.isArray(raw)) return [];
  // Handles the model invented map to nothing and vanish here, which is the
  // point of handles: an invented UUID would have looked exactly like a real
  // one and produced a filter matching nothing, silently.
  return raw
    .map((h) => (typeof h === "string" ? map.get(h.trim().toUpperCase()) : undefined))
    .filter((id): id is ID => typeof id === "string");
}

export async function suggestTracker(
  goal: { title: string; note: string; deadline: string | null },
  data: AppData,
  signal?: AbortSignal,
): Promise<Suggestion> {
  const inv = inventory(data);

  const described = [
    goal.title,
    goal.note.trim() !== "" ? `Why it matters: ${goal.note.trim()}` : "",
    goal.deadline ? `Deadline: ${goal.deadline}` : "No deadline.",
  ]
    .filter((s) => s !== "")
    .join("\n");

  const response = await fetch("/api/ai/goal-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: described, inventory: inv.text }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : "Could not read that goal.");
  }

  const raw = await response.json();
  if (raw?.trackable !== true) return { tracker: null, declined: true };

  const source = SOURCES.includes(raw.source) ? (raw.source as GoalSource) : null;
  if (source == null) return { tracker: null, declined: true };

  const target = Number(raw.target);
  if (!Number.isFinite(target) || target <= 0) return { tracker: null, declined: true };

  const windowDays = Number(raw.windowDays);

  return {
    tracker: {
      source,
      habitIds: source === "habits" ? ids(raw.habitIds, inv.habits) : [],
      courseIds: source === "tasks" ? ids(raw.courseIds, inv.courses) : [],
      categoryIds: ids(raw.categoryIds, inv.categories),
      keywords: Array.isArray(raw.keywords)
        ? raw.keywords
            .filter((k: unknown): k is string => typeof k === "string" && k.trim().length > 1)
            .slice(0, 6)
        : [],
      // Weight is a figure in kg, everything else is a count of things, so the
      // ceiling differs by two orders of magnitude.
      target: source === "weight" ? clamp(target, 20, 400) : Math.round(clamp(target, 1, 10_000)),
      // Capped at 90 to match the instruction. A model that answers 305 for
      // "every day for a month" has stopped describing a rolling window, and a
      // window that long never falls, which is the one thing it exists to do.
      windowDays: Number.isFinite(windowDays) ? Math.round(clamp(windowDays, 0, 90)) : 0,
      basis: typeof raw.basis === "string" ? raw.basis.trim().slice(0, 240) : "",
    },
    declined: false,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
