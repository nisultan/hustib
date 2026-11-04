import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { esc, InlineButton } from "./server";

/**
 * What the bot knows about one student at one moment, and the messages it
 * builds from that. Everything is read fresh from the database each time —
 * the bot has no state of its own beyond "already sent this".
 */

export interface Link {
  user_id: string;
  chat_id: number;
  timezone: string;
  morning_hour: number;
  evening_hour: number;
  notify_blocks: boolean;
  paused: boolean;
}

export interface LocalNow {
  date: string; // YYYY-MM-DD in the student's timezone
  hour: number;
  minute: number;
  /** Minutes since local midnight. */
  mins: number;
}

export function localNow(tz: string, at = new Date()): LocalNow {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
  } catch {
    return localNow("Asia/Almaty", at);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour, minute, mins: hour * 60 + minute };
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  status: string;
}
interface PlanRow {
  id: string;
  date: string;
  title: string;
  start_time: string | null;
  minutes: number;
  done: boolean;
}
interface GoalRow {
  id: string;
  title: string;
  deadline: string | null;
  status: string;
}
interface DayRow {
  id: string;
  title: string;
  date: string;
  kind: string;
  repeats_yearly: boolean;
}
interface HabitRow {
  id: string;
  name: string;
  weekdays: number[];
  created_at: string;
  archived_at: string | null;
}

export interface Snapshot {
  now: LocalNow;
  tasks: TaskRow[];
  plan: PlanRow[];
  goals: GoalRow[];
  important: DayRow[];
  habits: HabitRow[];
  habitsDone: string[];
  journaled: boolean;
}

export async function snapshot(db: SupabaseClient, link: Link, at = new Date()): Promise<Snapshot> {
  const now = localNow(link.timezone, at);
  const uid = link.user_id;
  const week = addDays(now.date, 7);
  const [tasks, plan, goals, important, habits, day] = await Promise.all([
    db.from("tasks").select("id,title,due_date,due_time,priority,status").eq("user_id", uid).neq("status", "completed"),
    db.from("plan_items").select("id,date,title,start_time,minutes,done").eq("user_id", uid).gte("date", now.date).lte("date", addDays(now.date, 1)),
    db.from("goals").select("id,title,deadline,status").eq("user_id", uid).in("status", ["active", "paused"]),
    db.from("important_days").select("id,title,date,kind,repeats_yearly").eq("user_id", uid),
    db.from("habits").select("id,name,weekdays,created_at,archived_at").eq("user_id", uid).is("archived_at", null),
    db.from("days").select("habits_done,reflection").eq("user_id", uid).eq("date", now.date).maybeSingle(),
  ]);
  const reflection = (day.data?.reflection ?? []) as { type?: string; text?: string }[];
  return {
    now,
    tasks: (tasks.data ?? []) as TaskRow[],
    plan: ((plan.data ?? []) as PlanRow[]).sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99")),
    goals: (goals.data ?? []) as GoalRow[],
    important: ((important.data ?? []) as DayRow[]).map((d) => ({ ...d, date: nextOccurrence(d, now.date) })).filter((d) => d.date >= now.date && d.date <= week),
    habits: (habits.data ?? []) as HabitRow[],
    habitsDone: (day.data?.habits_done ?? []) as string[],
    journaled: reflection.some((b) => b.type !== "image" && (b.text ?? "").trim() !== ""),
  };
}

function nextOccurrence(d: DayRow, today: string): string {
  if (!d.repeats_yearly) return d.date;
  const md = d.date.slice(5);
  const thisYear = `${today.slice(0, 4)}-${md}`;
  return thisYear >= today ? thisYear : `${Number(today.slice(0, 4)) + 1}-${md}`;
}

/* ------------------------------------------------------------------------- */

const hm = (t: string | null) => (t ? t.slice(0, 5) : "");
const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const PRIO_MARK: Record<string, string> = { urgent: "‼️ ", high: "❗ ", medium: "", low: "" };
const KIND_ICON: Record<string, string> = { exam: "📝", birthday: "🎂", holiday: "🌴", trip: "✈️", other: "📌" };

function whenLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function weekday(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function shortTitle(s: string, n = 28) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function habitsDueToday(s: Snapshot): HabitRow[] {
  const dow = new Date(`${s.now.date}T12:00:00Z`).getUTCDay();
  return s.habits.filter(
    (h) => h.created_at.slice(0, 10) <= s.now.date && (h.weekdays.length === 0 || h.weekdays.includes(dow)),
  );
}

export function doneButtons(tasks: TaskRow[]): InlineButton[][] {
  return tasks.slice(0, 5).map((t) => [{ text: `✓ ${shortTitle(t.title)}`, callback_data: `done:${t.id}` }]);
}

export interface Message {
  text: string;
  buttons?: InlineButton[][];
}

/** The morning brief. Always has something: at worst, "clear day". */
export function morning(s: Snapshot): Message {
  const today = s.now.date;
  const lines: string[] = [`☀️ <b>Good morning</b> — ${weekday(today)}`];

  const blocks = s.plan.filter((p) => p.date === today);
  if (blocks.length) {
    lines.push("", `<b>Plan · ${blocks.length}</b>`);
    for (const b of blocks.slice(0, 8)) lines.push(`${b.start_time ? `<code>${hm(b.start_time)}</code> ` : "• "}${esc(b.title)}`);
  }

  const dueToday = s.tasks.filter((t) => t.due_date === today);
  if (dueToday.length) {
    lines.push("", `<b>Due today · ${dueToday.length}</b>`);
    for (const t of dueToday.slice(0, 8)) lines.push(`• ${PRIO_MARK[t.priority]}${esc(t.title)}${t.due_time ? ` <i>by ${hm(t.due_time)}</i>` : ""}`);
  }

  const overdue = s.tasks.filter((t) => t.due_date != null && t.due_date < today).sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string));
  if (overdue.length) {
    lines.push("", `⚠️ <b>Overdue · ${overdue.length}</b>`);
    for (const t of overdue.slice(0, 5)) lines.push(`• ${esc(t.title)} <i>(${daysBetween(t.due_date as string, today)}d)</i>`);
    if (overdue.length > 5) lines.push(`<i>…and ${overdue.length - 5} more</i>`);
  }

  const soon = s.tasks
    .filter((t) => t.due_date != null && t.due_date > today && t.due_date <= addDays(today, 3) && (t.priority === "urgent" || t.priority === "high"))
    .slice(0, 3);
  if (soon.length) {
    lines.push("", "<b>Coming up</b>");
    for (const t of soon) lines.push(`• ${esc(t.title)} — ${whenLabel(daysBetween(today, t.due_date as string))}`);
  }

  const goalLines = s.goals
    .filter((g) => g.deadline != null)
    .map((g) => ({ g, d: daysBetween(today, g.deadline as string) }))
    .filter(({ d }) => d <= 7)
    .sort((a, b) => a.d - b.d)
    .map(({ g, d }) => (d < 0 ? `• ${esc(g.title)} — deadline passed, did you make it? Open Goals.` : `• ${esc(g.title)} — deadline ${whenLabel(d)}`));
  if (goalLines.length) lines.push("", "🎯 <b>Goals</b>", ...goalLines);

  if (s.important.length) {
    lines.push("", "📅 <b>This week</b>");
    for (const d of s.important.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)) {
      lines.push(`${KIND_ICON[d.kind] ?? "📌"} ${esc(d.title)} — ${whenLabel(daysBetween(today, d.date))}`);
    }
  }

  const habits = habitsDueToday(s);
  if (habits.length) lines.push("", `🔁 ${habits.length} habit${habits.length > 1 ? "s" : ""} today: ${habits.map((h) => esc(h.name)).slice(0, 5).join(", ")}`);

  if (lines.length === 1) lines.push("", "Clear day. Plan one thing worth doing and lock in.");
  return { text: lines.join("\n"), buttons: doneButtons(dueToday) };
}

/** The evening check. Null when there is nothing worth a ping. */
export function evening(s: Snapshot): Message | null {
  const today = s.now.date;
  const tomorrow = addDays(today, 1);
  const lines: string[] = ["🌙 <b>Evening check</b>"];

  const open = s.tasks.filter((t) => t.due_date === today);
  if (open.length) {
    lines.push("", `<b>Still open today · ${open.length}</b>`);
    for (const t of open.slice(0, 6)) lines.push(`• ${esc(t.title)}`);
  }

  const missedBlocks = s.plan.filter((p) => p.date === today && !p.done);
  if (missedBlocks.length) lines.push("", `${missedBlocks.length} block${missedBlocks.length > 1 ? "s" : ""} not ticked — done any of them? Tick them in the app.`);

  const habits = habitsDueToday(s).filter((h) => !s.habitsDone.includes(h.id));
  if (habits.length) lines.push("", `🔁 Habits left: ${habits.map((h) => esc(h.name)).slice(0, 5).join(", ")}`);

  const due = s.tasks.filter((t) => t.due_date === tomorrow);
  const goalsTomorrow = s.goals.filter((g) => g.deadline === tomorrow);
  const daysTomorrow = s.important.filter((d) => d.date === tomorrow);
  if (due.length || goalsTomorrow.length || daysTomorrow.length) {
    lines.push("", "<b>Tomorrow</b>");
    for (const t of due.slice(0, 6)) lines.push(`• ${PRIO_MARK[t.priority]}${esc(t.title)}${t.due_time ? ` <i>by ${hm(t.due_time)}</i>` : ""}`);
    for (const g of goalsTomorrow) lines.push(`🎯 Goal deadline: ${esc(g.title)}`);
    for (const d of daysTomorrow) lines.push(`${KIND_ICON[d.kind] ?? "📌"} ${esc(d.title)}`);
  }

  if (!s.journaled) lines.push("", "📓 Journal's empty today — three lines before bed?");

  if (lines.length === 1) return null;
  return { text: lines.join("\n"), buttons: doneButtons(open) };
}

export interface Ping extends Message {
  key: string;
}

/** Time-sensitive reminders: tasks due within the hour, blocks about to start. */
export function soon(s: Snapshot, link: Link): Ping[] {
  const today = s.now.date;
  const out: Ping[] = [];
  for (const t of s.tasks) {
    if (t.due_date !== today || !t.due_time) continue;
    const left = toMins(t.due_time) - s.now.mins;
    if (left > 0 && left <= 60) {
      out.push({
        key: `task-soon:${t.id}:${today}`,
        text: `⏰ <b>${esc(t.title)}</b> is due at ${hm(t.due_time)} — ${left} min left.`,
        buttons: doneButtons([t]),
      });
    }
  }
  if (link.notify_blocks) {
    for (const b of s.plan) {
      if (b.date !== today || !b.start_time || b.done) continue;
      const left = toMins(b.start_time) - s.now.mins;
      if (left >= -5 && left <= 15) {
        out.push({
          key: `block:${b.id}`,
          text: `▶️ ${left > 0 ? `In ${left} min` : "Now"}: <b>${esc(b.title)}</b> (${hm(b.start_time)}, ${b.minutes} min)`,
          buttons: [[{ text: "✓ Done", callback_data: `block:${b.id}` }]],
        });
      }
    }
  }
  return out;
}

/** /week: everything with a date in the next seven days, by day. */
export function week(s: Snapshot): Message {
  const today = s.now.date;
  const end = addDays(today, 7);
  const byDay = new Map<string, string[]>();
  const put = (d: string, line: string) => byDay.set(d, [...(byDay.get(d) ?? []), line]);
  for (const t of s.tasks) if (t.due_date && t.due_date >= today && t.due_date <= end) put(t.due_date, `• ${PRIO_MARK[t.priority]}${esc(t.title)}`);
  for (const g of s.goals) if (g.deadline && g.deadline >= today && g.deadline <= end) put(g.deadline, `🎯 ${esc(g.title)}`);
  for (const d of s.important) put(d.date, `${KIND_ICON[d.kind] ?? "📌"} ${esc(d.title)}`);
  if (byDay.size === 0) return { text: "📆 Nothing dated in the next 7 days." };
  const lines = ["📆 <b>Next 7 days</b>"];
  for (const d of [...byDay.keys()].sort()) lines.push("", `<b>${weekday(d)}</b> · ${whenLabel(daysBetween(today, d))}`, ...(byDay.get(d) as string[]));
  return { text: lines.join("\n") };
}

/** /next: the next block and the most pressing task. */
export function next(s: Snapshot): Message {
  const today = s.now.date;
  const block = s.plan.find((p) => p.date === today && !p.done && p.start_time && toMins(p.start_time) + p.minutes > s.now.mins);
  const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
  const task = [...s.tasks]
    .filter((t) => t.due_date != null && t.due_date <= addDays(today, 1))
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string) || rank[a.priority] - rank[b.priority])[0];
  const lines: string[] = [];
  if (block) lines.push(`▶️ Next block: <b>${esc(block.title)}</b> at ${hm(block.start_time)}`);
  if (task) lines.push(`📌 Most pressing: <b>${esc(task.title)}</b> — ${task.due_date === today ? "due today" : (task.due_date as string) < today ? "overdue" : "due tomorrow"}`);
  if (!lines.length) lines.push("Nothing pressing. Good time to get ahead.");
  return { text: lines.join("\n"), buttons: task ? doneButtons([task]) : undefined };
}
