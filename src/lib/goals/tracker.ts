import { AppData, Goal, GoalSource, GoalTracker, ID } from "@/lib/types";
import { addDays, todayISO, formatDate } from "@/lib/dates";
import { appliesOn } from "@/lib/habits";

// Re-exported so callers can take the spec and the arithmetic from one place.
export type { GoalSource, GoalTracker };

/**
 * Turning a goal into a number the hub can actually compute.
 *
 * A progress bar someone drags by hand measures how they felt about a goal on
 * the day they last touched it, which decays into a lie within a fortnight.
 * Everything needed to measure most goals honestly is already in here — habits
 * ticked, tasks finished, blocks kept, days written, weight recorded — it was
 * simply never connected to the goal it was evidence for.
 *
 * So a tracked goal carries a *measurement spec* rather than a number. The AI
 * writes the spec once, when the goal is created, because deciding that "read
 * more" means the "Read 20 pages" habit is a language problem. Evaluating it is
 * arithmetic, and arithmetic does not need a model: this file runs locally on
 * every render, costs nothing, and keeps working if the key is pulled.
 *
 * The one design decision worth naming is the window. A cumulative count only
 * ever rises, which suits "finish 40 past papers" and flatters a goal like
 * "train three times a week" — that one should fall when you stop. A spec with
 * `windowDays` set measures a rolling window and therefore can go down, which
 * is the whole point of asking whether you are still doing the thing.
 */

export interface TrackedProgress {
  /** 0-100, the number the bar draws. */
  value: number;
  observed: number;
  target: number;
  /** "habit ticks", "finished tasks", "kg" — whatever `observed` counts. */
  unit: string;
  basis: string;
  /** "last 30 days", or "since 21 Sep". */
  window: string;
  source: GoalSource;
  /** False when the spec points at something with no data behind it yet. */
  measured: boolean;
  /**
   * The line under the bar, written once here. Three places used to format it
   * for themselves, and each new kind of goal would have meant teaching all
   * three — and getting one of them wrong.
   */
  summary: string;
}

const SOURCE_LABEL: Record<GoalSource, string> = {
  habits: "habit ticks",
  tasks: "finished tasks",
  plan: "planned blocks",
  journal: "days written",
  weight: "weight",
  reflection: "journal reading",
};

export function sourceLabel(source: GoalSource): string {
  return SOURCE_LABEL[source];
}

/** Case-insensitive substring match against any of the spec's keywords. */
function hits(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const hay = text.toLowerCase();
  return keywords.some((k) => k.trim() !== "" && hay.includes(k.toLowerCase()));
}

/**
 * Does this task or block belong to the goal?
 *
 * The filters are alternatives rather than conditions: a task can be filed
 * under School or merely be called "Economics IA", and requiring both would
 * silently drop most of what someone actually does. A spec with nothing set on
 * any axis matches everything, which is only ever written for a goal that
 * genuinely is about volume.
 */
function matches(
  item: { title: string; courseId?: ID | null; categoryId?: ID | null },
  t: GoalTracker,
): boolean {
  if (t.courseIds.length === 0 && t.categoryIds.length === 0 && t.keywords.length === 0) {
    return true;
  }
  const byCourse =
    t.courseIds.length > 0 && item.courseId != null && t.courseIds.includes(item.courseId);
  const byCategory =
    t.categoryIds.length > 0 && item.categoryId != null && t.categoryIds.includes(item.categoryId);
  return byCourse || byCategory || hits(item.title, t.keywords);
}

export function evaluate(
  goal: Goal,
  tracker: GoalTracker,
  data: AppData,
  today = todayISO(),
): TrackedProgress {
  const from =
    tracker.windowDays > 0
      ? addDays(today, -(tracker.windowDays - 1))
      : goal.createdAt.slice(0, 10);
  const window =
    tracker.windowDays > 0 ? `last ${tracker.windowDays} days` : `since ${formatDate(from)}`;
  const inWindow = (date: string | null | undefined): boolean =>
    typeof date === "string" && date.slice(0, 10) >= from && date.slice(0, 10) <= today;

  if (tracker.source === "weight") return weight(goal, tracker, data);
  if (tracker.source === "reflection") return reading(tracker, today);
  if (tracker.measure === "rate" && (tracker.source === "habits" || tracker.source === "plan")) {
    return rate(tracker, data, today, from, window);
  }

  const target = Math.max(tracker.target, 0);
  let observed = 0;

  if (tracker.source === "habits") {
    const wanted =
      tracker.habitIds.length > 0
        ? new Set(tracker.habitIds)
        : new Set(data.habits.filter((h) => h.archivedAt == null).map((h) => h.id));
    for (const day of data.days) {
      if (!inWindow(day.date)) continue;
      for (const id of day.habitsDone) if (wanted.has(id)) observed += 1;
    }
  }

  if (tracker.source === "tasks") {
    observed = data.tasks.filter(
      (t) => t.status === "completed" && inWindow(t.completedAt) && matches(t, tracker),
    ).length;
  }

  if (tracker.source === "plan") {
    observed = data.plan.filter((p) => p.done && inWindow(p.date) && matches(p, tracker)).length;
  }

  if (tracker.source === "journal") {
    observed = data.days.filter(
      (d) => inWindow(d.date) && d.reflection.some((b) => b.text.trim() !== ""),
    ).length;
  }

  return {
    value: target === 0 ? 0 : clamp(Math.round((observed / target) * 100)),
    observed,
    target,
    unit: SOURCE_LABEL[tracker.source],
    basis: tracker.basis,
    window,
    source: tracker.source,
    measured: true,
    summary: `${observed} of ${target} ${SOURCE_LABEL[tracker.source]} · ${window}`,
  };
}

/**
 * How reliably something is done, rather than how much of it.
 *
 * "Follow my plan" measured as a count rewards planning more; measured as a
 * rate it rewards doing what was planned, which is the goal. Same for habits:
 * keeping a habit five days in seven is the thing, however many habits there
 * are. The target is the percentage that counts as success, so 80% of planned
 * blocks done against a target of 80 is a full bar.
 */
function rate(
  tracker: GoalTracker,
  data: AppData,
  today: string,
  from: string,
  window: string,
): TrackedProgress {
  // Today is still being lived; a block not yet ticked at breakfast is not a
  // block missed.
  const last = addDays(today, -1);
  let done = 0;
  let due = 0;

  if (tracker.source === "plan") {
    for (const p of data.plan) {
      if (p.date < from || p.date > last || !matches(p, tracker)) continue;
      due += 1;
      if (p.done) done += 1;
    }
  } else {
    const habits = data.habits.filter(
      (h) =>
        h.archivedAt == null && (tracker.habitIds.length === 0 || tracker.habitIds.includes(h.id)),
    );
    const byDate = new Map(data.days.map((d) => [d.date, d]));
    for (let date = from; date <= last; date = addDays(date, 1)) {
      for (const h of habits) {
        if (!appliesOn(h, date)) continue;
        due += 1;
        if (byDate.get(date)?.habitsDone.includes(h.id)) done += 1;
      }
    }
  }

  const target = Math.min(100, Math.max(tracker.target, 1));
  const pct = due === 0 ? 0 : Math.round((done / due) * 100);
  const what = tracker.source === "plan" ? "planned blocks done" : "habit days kept";

  return {
    value: due === 0 ? 0 : clamp(Math.round((pct / target) * 100)),
    observed: pct,
    target,
    unit: "%",
    basis: tracker.basis,
    window,
    source: tracker.source,
    measured: due > 0,
    summary:
      due === 0
        ? `Nothing ${tracker.source === "plan" ? "planned" : "due"} yet · ${window}`
        : `${pct}% of ${what} (${done}/${due}) · aiming for ${target}% · ${window}`,
  };
}

/**
 * Progress as read from the journal, for goals nothing countable measures.
 *
 * The number comes from the last reading, which is refreshed every few days
 * rather than on every render — the arithmetic sources are free to recompute,
 * this one costs a call. Until the first reading lands it says so rather than
 * drawing an empty bar that looks like a verdict.
 */
function reading(tracker: GoalTracker, today: string): TrackedProgress {
  const j = tracker.judged;
  if (!j) {
    return {
      value: 0,
      observed: 0,
      target: 100,
      unit: "",
      basis: tracker.basis,
      window: "",
      source: "reflection",
      measured: false,
      summary: "Waiting for the first read of your journal.",
    };
  }
  const ago = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${j.at.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  const when = ago <= 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`;
  return {
    value: clamp(Math.round(j.value)),
    observed: j.value,
    target: 100,
    unit: "",
    basis: tracker.basis,
    window: when,
    source: "reflection",
    measured: true,
    summary: `${j.why} · read from your journal ${when}`,
  };
}

/**
 * Weight is the one source that is a distance rather than a count.
 *
 * Measured as the fraction of the gap closed between where they were when the
 * goal was set and where they said they wanted to be. That works unchanged for
 * putting weight on: it is a ratio of two signed distances, so both ends simply
 * swap and nothing else has to know which direction the goal runs in.
 */
function weight(goal: Goal, tracker: GoalTracker, data: AppData): TrackedProgress {
  const weighed = data.days
    .filter((d) => d.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const started = goal.createdAt.slice(0, 10);
  // The first weigh-in on or after the day the goal was set is the honest
  // baseline. Falling back to the last one before it keeps a goal written the
  // evening before a weigh-in from reading as unmeasurable.
  const baseline =
    weighed.find((d) => d.date >= started)?.weight ??
    [...weighed].reverse().find((d) => d.date < started)?.weight ??
    null;
  const current = weighed[weighed.length - 1]?.weight ?? null;

  if (baseline == null || current == null) {
    return {
      value: 0,
      observed: 0,
      target: tracker.target,
      unit: "kg",
      basis: tracker.basis,
      window: "no weigh-ins yet",
      source: "weight",
      measured: false,
      summary: "No weigh-ins yet.",
    };
  }

  const span = baseline - tracker.target;
  const done = baseline - current;
  const value =
    span === 0 ? (current === tracker.target ? 100 : 0) : clamp(Math.round((done / span) * 100));

  return {
    value,
    observed: current,
    target: tracker.target,
    unit: "kg",
    basis: tracker.basis,
    window: `from ${baseline} kg`,
    source: "weight",
    measured: true,
    summary: `${current} kg → ${tracker.target} kg · started at ${baseline} kg`,
  };
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/**
 * The progress a goal should show, however it is tracked.
 *
 * One entry point, so nothing else has to know whether a given goal is measured
 * or hand-set — the card, the dashboard and the assistant's context all ask the
 * same question and get a number.
 */
export function progressOf(
  goal: Goal,
  data: AppData,
  today = todayISO(),
): { value: number | null; tracked: TrackedProgress | null } {
  if (goal.tracker) {
    const tracked = evaluate(goal, goal.tracker, data, today);
    return { value: tracked.value, tracked };
  }
  return { value: goal.progress, tracked: null };
}

/** Plain English for the spec itself, for the line under the bar. */
export function describe(tracker: GoalTracker, data: AppData): string {
  if (tracker.source === "weight") return `Towards ${tracker.target} kg`;
  if (tracker.source === "reflection") return "Read from your journal every few days";

  const names = (ids: ID[], from: { id: ID; name: string }[]) =>
    ids
      .map((id) => from.find((x) => x.id === id)?.name)
      .filter((n): n is string => typeof n === "string")
      .join(", ");

  const who =
    tracker.source === "habits"
      ? names(tracker.habitIds, data.habits) || "any habit"
      : [
          names(tracker.courseIds, data.courses),
          names(tracker.categoryIds, data.categories),
          tracker.keywords.join(", "),
        ]
          .filter((s) => s !== "")
          .join(" · ");

  const bits =
    tracker.measure === "rate"
      ? [
          `${tracker.target}% of ${tracker.source === "plan" ? "planned blocks done" : "habit days kept"}`,
        ]
      : [`${tracker.target} ${SOURCE_LABEL[tracker.source]}`];
  if (who !== "" && tracker.source !== "journal") bits.push(who);
  bits.push(tracker.windowDays > 0 ? `rolling ${tracker.windowDays} days` : "cumulative");
  return bits.join(" · ");
}
