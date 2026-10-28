import { AppData, Block, PRIORITY_RANK, Task } from "@/lib/types";
import { progressOf } from "@/lib/goals/tracker";
import { habitPatterns, pct, planPatterns, weekdayNames } from "@/lib/consistency";
import { courseAverage, overallAverage, trend } from "@/lib/grades";
import { daysUntil, todayISO } from "@/lib/dates";
import { productivity } from "@/lib/productivity";

/**
 * The student's whole hub, flattened into something a model can read.
 *
 * Deliberately prose-shaped rather than raw JSON. The model is being asked to
 * reason about a person's week, not to parse a database, and every token spent
 * on punctuation is a token not spent on their reflections. Figures that the
 * app already computes carefully — weighted averages, trends — are computed
 * here too rather than left for the model to infer from raw scores, because
 * arithmetic is the one thing it should never be guessing at.
 *
 * Everything is bounded. A student two years in should not silently blow the
 * context window, and the oldest rows are the least useful ones anyway.
 */

const MAX_OPEN_TASKS = 40;
const MAX_DONE_TASKS = 10;
const MAX_GRADES_PER_COURSE = 6;
/*
 * The journal gets a budget rather than a row limit.
 *
 * It is the only place the hub holds the student's own words, and it is where
 * everything interesting comes from — a fortnight of it was enough to answer
 * "how is this week going" and nowhere near enough to notice they have been
 * circling the same worry since March. Recent days are kept close to whole;
 * older ones are trimmed but still present, because the value of an old entry
 * is usually that it rhymes with a new one.
 *
 * Sized against what a year of journalling actually costs — roughly 10k tokens
 * at the ceiling, which the model has room for many times over.
 */
const JOURNAL_BUDGET_CHARS = 40_000;
const RECENT_DAYS = 45;
const RECENT_ENTRY_CHARS = 2_400;
const OLDER_ENTRY_CHARS = 500;

export function buildContext(data: AppData): string {
  const today = todayISO();
  const out: string[] = [];

  out.push(`Today is ${today} (${weekday(today)}). The student is ${data.profile.name}.`);

  out.push(section("CATEGORIES", categories(data)));
  out.push(section("COURSES", courses(data)));
  out.push(section("OPEN TASKS", openTasks(data)));
  out.push(section("RECENTLY COMPLETED", doneTasks(data)));
  out.push(section("GRADES", grades(data)));
  out.push(section("GOALS", goals(data, today)));
  out.push(section("UNIVERSITIES", universities(data)));
  out.push(section("TODAY'S PLAN", plan(data, today)));
  out.push(section("HABITS", habits(data, today)));
  out.push(section("PLAN FOLLOW-THROUGH", planFollowThrough(data, today)));
  out.push(section("CONSISTENCY", consistency(data, today)));
  out.push(section("JOURNAL", journal(data)));
  out.push(section("WHAT YOU HAVE LEARNED ABOUT THEM", memory(data)));

  return out.filter(Boolean).join("\n\n");
}

function section(title: string, body: string): string {
  return body.trim() === "" ? "" : `## ${title}\n${body.trim()}`;
}

/** The parts of life the student sorts tasks by, in their own words. */
function categories(data: AppData): string {
  return data.categories.map((c) => `- ${c.name} (id ${c.id})`).join("\n");
}

function courses(data: AppData): string {
  return data.courses
    .map((c) => {
      const avg = courseAverage(data.grades, c.id);
      const score = avg.value == null ? "no grades yet" : `average ${avg.value}%`;
      const topics = c.lessons.length > 0 ? ` — topics: ${c.lessons.join(", ")}` : "";
      return `- ${c.name} (${c.code}, id ${c.id}): ${score}${topics}`;
    })
    .join("\n");
}

function openTasks(data: AppData): string {
  const open = data.tasks
    .filter((t) => t.status !== "completed")
    .sort(byUrgency)
    .slice(0, MAX_OPEN_TASKS);

  return open.map((t) => `- ${taskLine(t, data)}`).join("\n");
}

function doneTasks(data: AppData): string {
  return data.tasks
    .filter((t) => t.status === "completed" && t.completedAt)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, MAX_DONE_TASKS)
    .map((t) => `- ${t.title}${courseSuffix(t.courseId, data)}`)
    .join("\n");
}

/** Overdue first, then soonest, then by priority — the order a student feels. */
function byUrgency(a: Task, b: Task): number {
  const ad = a.dueDate ? daysUntil(a.dueDate) : Infinity;
  const bd = b.dueDate ? daysUntil(b.dueDate) : Infinity;
  if (ad !== bd) return ad - bd;
  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
}

function taskLine(t: Task, data: AppData): string {
  const bits = [`"${t.title}" (id ${t.id})`, t.priority];

  if (t.dueDate) {
    const d = daysUntil(t.dueDate);
    const when =
      d < 0
        ? `OVERDUE by ${-d}d`
        : d === 0
          ? "due TODAY"
          : d === 1
            ? "due tomorrow"
            : `due in ${d}d`;
    bits.push(`${when} (${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ""})`);
  } else {
    bits.push("no deadline");
  }

  const category = data.categories.find((c) => c.id === t.categoryId);
  if (category) bits.push(category.name);
  if (t.status === "in_progress") bits.push("in progress");
  const course = courseSuffix(t.courseId, data);
  if (course) bits.push(course.replace(" — ", ""));
  if (t.notes.trim()) bits.push(`notes: ${truncate(t.notes, 160)}`);

  return bits.join(" · ");
}

function courseSuffix(courseId: string | null, data: AppData): string {
  const course = data.courses.find((c) => c.id === courseId);
  return course ? ` — ${course.name}` : "";
}

function grades(data: AppData): string {
  if (data.grades.length === 0) return "";

  const overall = overallAverage(data.grades, data.courses);
  const t = trend(data.grades);
  const lines: string[] = [];

  if (overall.value != null) {
    const direction = t
      ? `, ${t.direction} (${t.delta > 0 ? "+" : ""}${t.delta} pts over ${t.days}d)`
      : "";
    lines.push(`Overall average: ${overall.value}%${direction}`);
  }

  for (const c of data.courses) {
    const mine = data.grades
      .filter((g) => g.courseId === c.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_GRADES_PER_COURSE);
    if (mine.length === 0) continue;

    const avg = courseAverage(data.grades, c.id);
    const recent = mine
      .map(
        (g) =>
          `${g.assessment} ${g.score}%${g.weight ? ` (weight ${g.weight}%)` : ""} on ${g.date}`,
      )
      .join("; ");
    lines.push(`${c.name}: average ${avg.value}% over ${avg.count} — recent: ${recent}`);
  }

  return lines.join("\n");
}

/** What the student is aiming at, which is the point of everything else here. */
function goals(data: AppData, today: string): string {
  return data.goals
    .filter((g) => g.status !== "paused")
    .sort((a, b) => a.position - b.position)
    .map((g) => {
      const bits: string[] = [g.priority];
      if (g.status === "achieved")
        bits.push(`ACHIEVED${g.achievedAt ? ` ${g.achievedAt}` : ""}`);
      if (g.deadline) bits.push(`deadline ${g.deadline} (in ${daysUntil(g.deadline)}d)`);
      /*
        A tracked goal reports what it was counted from, not just the
        percentage. "62% done" tells the assistant nothing it can act on;
        "62% — 18 of 28 habit ticks in the last 28 days" lets it say which
        evening is the one that moved the bar, which is the point of having
        connected the two at all.
      */
      const { value, tracked } = progressOf(g, data, today);
      if (value != null) {
        bits.push(tracked?.measured ? `${value}% (${tracked.summary})` : `${value}% done`);
      }
      if (tracked && !tracked.measured) bits.push("tracked, but nothing recorded yet");
      const why = g.note.trim() ? ` — ${truncate(g.note, 200)}` : "";
      return `- "${g.title}" (id ${g.id}) · ${bits.join(" · ")}${why}`;
    })
    .join("\n");
}

function universities(data: AppData): string {
  return data.universities
    .map((u) => {
      const deadline = u.deadline
        ? `deadline ${u.deadline} (in ${daysUntil(u.deadline)}d)`
        : "no deadline set";
      const notes = u.notes.trim() ? ` · notes: ${truncate(u.notes, 160)}` : "";
      return `- ${u.name}, ${u.city} ${u.country} (id ${u.id}) — ${u.program} · ${u.priority} · ${u.status} · ${deadline}${notes}`;
    })
    .join("\n");
}

/** What the student actually set aside time for today, and whether it happened. */
function plan(data: AppData, today: string): string {
  return data.plan
    .filter((p) => p.date === today)
    .sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99"))
    .map((p) => {
      const when = p.start ? p.start : "no time set";
      return `- ${p.done ? "[done]" : "[ ]"} ${p.title} (${when}, ${p.minutes}min)`;
    })
    .join("\n");
}

function habits(data: AppData, today: string): string {
  const patterns = habitPatterns(data, today);
  if (patterns.length === 0) return "";

  const live = new Map(data.habits.map((h) => [h.id, h]));

  /*
    One line per habit, carrying the four things worth saying about it: is a
    run riding on today, has it quietly stopped, is it getting better or worse,
    and which day does it die on. Totals alone support none of those — "kept 9
    of 14" cannot tell you that the 9 were all in the first week.

    Spelled out in words rather than numbers where it matters, because the
    model is better at noticing "slipping" than at subtracting two fractions.
  */
  return patterns
    .map((p) => {
      const h = live.get(p.id);
      const schedule =
        !h || h.weekdays.length === 0 ? "every day" : weekdayNames(h.weekdays);

      const bits: string[] = [];
      bits.push(p.streak > 0 ? `${p.streak}-day run` : "no run going");
      bits.push(
        p.dueToday ? (p.doneToday ? "done today" : "DUE TODAY, not yet done") : "not due today",
      );

      if (p.lastKept == null) bits.push("never kept");
      else if (p.lastKept > 2) bits.push(`last kept ${p.lastKept} days ago`);

      if (p.due > 0) bits.push(`${p.kept}/${p.due} kept over 4 weeks`);

      if (p.trend === "up") {
        bits.push(`IMPROVING: ${pct(p.recent)} last fortnight vs ${pct(p.before)} before`);
      } else if (p.trend === "down") {
        bits.push(`SLIPPING: ${pct(p.recent)} last fortnight vs ${pct(p.before)} before`);
      }

      if (p.weakDays.length > 0) bits.push(`usually missed on ${weekdayNames(p.weakDays)}`);

      return `- ${p.name} (${schedule}) — ${bits.join(" · ")}`;
    })
    .join("\n");
}

/**
 * Whether the planned day tends to happen, over the last fortnight.
 *
 * Split by time of day and by category, because that is where a plan breaks
 * and where the advice has to land — "your evening blocks almost never happen"
 * is something to act on; "64% completion" is something to feel bad about.
 */
function planFollowThrough(data: AppData, today: string): string {
  const p = planPatterns(data, today);
  if (p.planned < 4) return "";

  const slice = (s: { label: string; planned: number; done: number }) =>
    `${s.label} ${s.done}/${s.planned}`;

  const lines = [
    `Planned ${p.planned} blocks over the last 14 days, did ${p.done} (${pct(p.done / p.planned)}).`,
  ];
  if (p.byPart.length > 1) lines.push(`By time of day: ${p.byPart.map(slice).join(", ")}.`);
  if (p.byCategory.length > 1) lines.push(`By category: ${p.byCategory.map(slice).join(", ")}.`);
  return lines.join("\n");
}

function consistency(data: AppData, today: string): string {
  const result = productivity(data, today);
  if (result.score == null) return "";

  const lines = [`Consistency score: ${result.score}/100 over ${result.windowDays} days`];
  if (result.streak > 0)
    lines.push(`Current streak: ${result.streak} days (best ${result.bestStreak})`);
  for (const s of result.signals) {
    if (s.rate != null) lines.push(`- ${s.label}: ${s.detail}`);
  }
  return lines.join("\n");
}

/**
 * The journal is where the model earns its keep: it is the only place the app
 * holds how the student actually felt, and connecting "exhausted all week" to
 * a dip in grades is the kind of link a rules engine cannot make.
 */
function journal(data: AppData): string {
  const days = [...data.days].sort((a, b) => b.date.localeCompare(a.date));
  const today = todayISO();

  const lines: string[] = [];
  let spent = 0;
  let omitted = 0;

  for (const day of days) {
    const text = blocksToText(day.reflection);
    const weight = day.weight != null ? `weight ${day.weight}kg` : null;
    if (!text && !weight) continue;

    if (spent >= JOURNAL_BUDGET_CHARS) {
      omitted += 1;
      continue;
    }

    const recent = daysUntil(day.date) >= -RECENT_DAYS;
    const body = text ? truncate(text, recent ? RECENT_ENTRY_CHARS : OLDER_ENTRY_CHARS) : "";

    // The heading carries the weekday and the distance, so a run of bad
    // Sundays is visible without the model reconstructing a calendar.
    const head = `- ${day.date} (${weekday(day.date)}, ${agoLabel(day.date, today)})`;
    const entry = [`${head}${weight ? ` — ${weight}` : ""}`, body ? `  ${body}` : ""]
      .filter(Boolean)
      .join("\n");

    lines.push(entry);
    spent += entry.length;
  }

  if (omitted > 0) {
    lines.push(`- (${omitted} older ${omitted === 1 ? "entry" : "entries"} not shown)`);
  }

  return lines.join("\n");
}

/** How long ago, in the units a person would use for that distance. */
function agoLabel(iso: string, today: string): string {
  if (iso === today) return "today";
  const d = -daysUntil(iso);
  if (d < 0) return "upcoming";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

/**
 * Carried into every conversation, so the assistant starts each one already
 * knowing the student rather than meeting them again.
 */
function memory(data: AppData): string {
  return data.memory.map((n) => `- (${n.topic}) ${n.note}`).join("\n");
}

function blocksToText(blocks: Block[]): string {
  return (
    blocks
      .map((b) => {
        if (b.type === "divider") return "";
        if (b.type === "todo") return `[${b.done ? "x" : " "}] ${b.text}`;
        if (b.type === "bullet") return `• ${b.text}`;
        if (b.type === "quote") return `> ${b.text}`;
        // The picture itself is useless here and would swamp everything else;
        // the caption is the part that carries meaning.
        if (b.type === "image") return b.text ? `[image: ${b.text}]` : "[image]";
        if (b.type === "link") return `[link: ${b.text || b.href || ""}]`;
        if (b.type === "h2" || b.type === "h3") return `## ${b.text}`;
        return b.text;
      })
      .filter((s) => s.trim() !== "")
      // Kept on separate lines rather than run together: the shape of how
      // someone wrote a day is part of what is being read for.
      .join("\n  ")
  );
}

/** Collapses runs of spaces but keeps line breaks, which carry the structure. */
function truncate(s: string, max: number): string {
  const clean = s.replace(/[^\S\n]+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`;
}

function weekday(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" });
}
