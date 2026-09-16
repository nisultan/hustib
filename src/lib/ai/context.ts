import { AppData, Block, PRIORITY_RANK, Task } from "@/lib/types";
import { courseAverage, overallAverage, trend } from "@/lib/grades";
import { daysUntil, todayISO } from "@/lib/dates";

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
const MAX_JOURNAL_DAYS = 14;
const MAX_REFLECTION_CHARS = 600;

export function buildContext(data: AppData): string {
  const today = todayISO();
  const out: string[] = [];

  out.push(`Today is ${today} (${weekday(today)}). The student is ${data.profile.name}.`);

  out.push(section("COURSES", courses(data)));
  out.push(section("OPEN TASKS", openTasks(data)));
  out.push(section("RECENTLY COMPLETED", doneTasks(data)));
  out.push(section("GRADES", grades(data)));
  out.push(section("UNIVERSITIES", universities(data)));
  out.push(section("JOURNAL", journal(data)));
  out.push(section("WHAT YOU HAVE LEARNED ABOUT THEM", memory(data)));

  return out.filter(Boolean).join("\n\n");
}

function section(title: string, body: string): string {
  return body.trim() === "" ? "" : `## ${title}\n${body.trim()}`;
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
      d < 0 ? `OVERDUE by ${-d}d` : d === 0 ? "due TODAY" : d === 1 ? "due tomorrow" : `due in ${d}d`;
    bits.push(`${when} (${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ""})`);
  } else {
    bits.push("no deadline");
  }

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
    const direction = t ? `, ${t.direction} (${t.delta > 0 ? "+" : ""}${t.delta} pts over ${t.days}d)` : "";
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
      .map((g) => `${g.assessment} ${g.score}%${g.weight ? ` (weight ${g.weight}%)` : ""} on ${g.date}`)
      .join("; ");
    lines.push(`${c.name}: average ${avg.value}% over ${avg.count} — recent: ${recent}`);
  }

  return lines.join("\n");
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

/**
 * The journal is where the model earns its keep: it is the only place the app
 * holds how the student actually felt, and connecting "exhausted all week" to
 * a dip in grades is the kind of link a rules engine cannot make.
 */
function journal(data: AppData): string {
  return [...data.days]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_JOURNAL_DAYS)
    .map((d) => {
      const weight = d.weight != null ? `weight ${d.weight}kg` : null;
      const text = blocksToText(d.reflection);
      const body = [weight, text ? `reflection: ${truncate(text, MAX_REFLECTION_CHARS)}` : null]
        .filter(Boolean)
        .join(" · ");
      return body ? `- ${d.date}: ${body}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Carried into every conversation, so the assistant starts each one already
 * knowing the student rather than meeting them again.
 */
function memory(data: AppData): string {
  return data.memory.map((n) => `- (${n.topic}) ${n.note}`).join("\n");
}

function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === "divider") return "";
      if (b.type === "todo") return `[${b.done ? "x" : " "}] ${b.text}`;
      if (b.type === "bullet") return `• ${b.text}`;
      return b.text;
    })
    .filter((s) => s.trim() !== "")
    .join(" / ");
}

function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`;
}

function weekday(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" });
}
