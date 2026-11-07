import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { esc, InlineButton } from "./server";

/**
 * What the bot knows about one student at one moment, and the messages it
 * builds from that. Everything is read fresh from the database each time —
 * the bot has no state of its own beyond "already sent this" (and snoozes,
 * which live in the same log).
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
  /** 0 = Sunday. */
  dow: number;
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
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { date, hour, minute, mins: hour * 60 + minute, dow: new Date(`${date}T12:00:00Z`).getUTCDay() };
}

export interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  status: string;
}
export interface PlanRow {
  id: string;
  date: string;
  title: string;
  start_time: string | null;
  minutes: number;
  done: boolean;
}
export interface GoalRow {
  id: string;
  title: string;
  note: string | null;
  deadline: string | null;
  status: string;
  priority: string;
  created_at: string;
  extras?: { pushes?: string[]; reward?: string; cost?: string; mantra?: string; milestones?: { text: string; done: boolean }[] } | null;
}
interface DayRow {
  id: string;
  title: string;
  date: string;
  kind: string;
  repeats_yearly: boolean;
}
export interface HabitRow {
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
  /** Marked as a gym day (migration 014). */
  gym: boolean;
}

export async function snapshot(db: SupabaseClient, link: Link, at = new Date()): Promise<Snapshot> {
  const now = localNow(link.timezone, at);
  const uid = link.user_id;
  const week = addDays(now.date, 7);
  const [tasks, plan, goals, important, habits, day] = await Promise.all([
    db.from("tasks").select("id,title,due_date,due_time,priority,status").eq("user_id", uid).neq("status", "completed"),
    db.from("plan_items").select("id,date,title,start_time,minutes,done").eq("user_id", uid).gte("date", now.date).lte("date", addDays(now.date, 1)),
    loadGoals(db, uid),
    db.from("important_days").select("id,title,date,kind,repeats_yearly").eq("user_id", uid),
    db.from("habits").select("id,name,weekdays,created_at,archived_at").eq("user_id", uid).is("archived_at", null),
    // "*" so a database without the gym column (014) still answers.
    db.from("days").select("*").eq("user_id", uid).eq("date", now.date).maybeSingle(),
  ]);
  const reflection = (day.data?.reflection ?? []) as { type?: string; text?: string }[];
  return {
    now,
    tasks: (tasks.data ?? []) as TaskRow[],
    plan: ((plan.data ?? []) as PlanRow[]).sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99")),
    goals,
    important: ((important.data ?? []) as DayRow[]).map((d) => ({ ...d, date: nextOccurrence(d, now.date) })).filter((d) => d.date >= now.date && d.date <= week),
    habits: (habits.data ?? []) as HabitRow[],
    habitsDone: (day.data?.habits_done ?? []) as string[],
    gym: day.data?.gym === true,
    journaled: Array.isArray(reflection) && reflection.some((b) => b.type !== "image" && (b.text ?? "").trim() !== ""),
  };
}

/** Goals with their page extras when the database has them (migration 013). */
async function loadGoals(db: SupabaseClient, uid: string): Promise<GoalRow[]> {
  const full = await db
    .from("goals")
    .select("id,title,note,deadline,status,priority,created_at,extras")
    .eq("user_id", uid)
    .in("status", ["active", "paused"]);
  if (!full.error) return (full.data ?? []) as GoalRow[];
  const bare = await db
    .from("goals")
    .select("id,title,note,deadline,status,priority,created_at")
    .eq("user_id", uid)
    .in("status", ["active", "paused"]);
  return (bare.data ?? []) as GoalRow[];
}

function nextOccurrence(d: DayRow, today: string): string {
  if (!d.repeats_yearly) return d.date;
  const md = d.date.slice(5);
  const thisYear = `${today.slice(0, 4)}-${md}`;
  return thisYear >= today ? thisYear : `${Number(today.slice(0, 4)) + 1}-${md}`;
}

/* ------------------------------------------------------------------------- */

export const hm = (t: string | null) => (t ? t.slice(0, 5) : "");
export const toMins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const PRIO_MARK: Record<string, string> = { urgent: "‼️ ", high: "❗ ", medium: "", low: "" };
const PRIO_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const KIND_ICON: Record<string, string> = { exam: "📝", birthday: "🎂", holiday: "🌴", trip: "✈️", other: "📌" };

function whenLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0) return `${-days}d overdue`;
  return `in ${days} days`;
}

function weekday(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function shortTitle(s: string, n = 26) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function duration(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${r}m`;
}

function lastDayOfMonth(date: string): boolean {
  return addDays(date, 1).slice(5, 7) !== date.slice(5, 7);
}

export function habitsDueToday(s: Snapshot): HabitRow[] {
  return s.habits.filter((h) => h.created_at.slice(0, 10) <= s.now.date && (h.weekdays.length === 0 || h.weekdays.includes(s.now.dow)));
}

/** Most pressing first: overdue, then by date, time and priority. */
export function byUrgency(a: TaskRow, b: TaskRow): number {
  return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || (a.due_time ?? "99").localeCompare(b.due_time ?? "99") || PRIO_RANK[a.priority] - PRIO_RANK[b.priority];
}

export function doneButtons(tasks: TaskRow[]): InlineButton[][] {
  return tasks.slice(0, 6).map((t) => [{ text: `✓ ${shortTitle(t.title)}`, callback_data: `done:${t.id}` }]);
}

/** Done plus the ways to put it off, under a single task reminder. */
export function taskActions(t: TaskRow): InlineButton[][] {
  return [
    [{ text: "✓ Done", callback_data: `done:${t.id}` }],
    [
      { text: "⏰ 30m", callback_data: `snz:${t.id}:30` },
      { text: "⏰ 2h", callback_data: `snz:${t.id}:120` },
      { text: "📅 Tomorrow", callback_data: `tmr:${t.id}` },
    ],
  ];
}

function habitButtons(habits: HabitRow[]): InlineButton[][] {
  const rows: InlineButton[][] = [];
  for (let i = 0; i < Math.min(habits.length, 6); i += 2) {
    rows.push(habits.slice(i, i + 2).map((h) => ({ text: `🔁 ${shortTitle(h.name, 18)}`, callback_data: `hab:${h.id}` })));
  }
  return rows;
}

export interface Message {
  text: string;
  buttons?: InlineButton[][];
}

/* --------------------------------- Briefs --------------------------------- */

/** The morning brief. Always has something: at worst, "clear day". */
export function morning(s: Snapshot): Message {
  const today = s.now.date;
  const lines: string[] = [`☀️ <b>Good morning</b> — ${weekday(today)}`];

  if (s.now.dow === 0) lines.push("", "📊 Your <b>weekly report</b> is open today — only today. Open Lock In → Report.");
  if (lastDayOfMonth(today)) lines.push("", "📊 Your <b>monthly report</b> unlocks today. Open Lock In → Report.");

  const blocks = s.plan.filter((p) => p.date === today);
  if (blocks.length) {
    const total = blocks.reduce((a, b) => a + b.minutes, 0);
    lines.push("", `<b>Plan · ${blocks.length} blocks · ${duration(total)}</b>`);
    for (const b of blocks.slice(0, 8)) lines.push(`${b.start_time ? `<code>${hm(b.start_time)}</code> ` : "• "}${esc(b.title)}`);
    if (blocks.length > 8) lines.push(`<i>…and ${blocks.length - 8} more</i>`);
  } else {
    lines.push("", "No plan for today yet — plan the day in the app, or ask Lifee to.");
  }

  const dueToday = s.tasks.filter((t) => t.due_date === today).sort(byUrgency);
  if (dueToday.length) {
    lines.push("", `<b>Due today · ${dueToday.length}</b>`);
    for (const t of dueToday.slice(0, 8)) lines.push(`• ${PRIO_MARK[t.priority]}${esc(t.title)}${t.due_time ? ` <i>by ${hm(t.due_time)}</i>` : ""}`);
  }

  const overdue = s.tasks.filter((t) => t.due_date != null && t.due_date < today).sort(byUrgency);
  if (overdue.length) {
    lines.push("", `⚠️ <b>Overdue · ${overdue.length}</b>`);
    for (const t of overdue.slice(0, 5)) lines.push(`• ${esc(t.title)} <i>(${daysBetween(t.due_date as string, today)}d)</i>`);
    if (overdue.length > 5) lines.push(`<i>…and ${overdue.length - 5} more</i>`);
  }

  const soon = s.tasks
    .filter((t) => t.due_date != null && t.due_date > today && t.due_date <= addDays(today, 3) && (t.priority === "urgent" || t.priority === "high"))
    .sort(byUrgency)
    .slice(0, 3);
  if (soon.length) {
    lines.push("", "<b>Coming up</b>");
    for (const t of soon) lines.push(`• ${esc(t.title)} — ${whenLabel(daysBetween(today, t.due_date as string))}`);
  }

  const goalLines = s.goals
    .filter((g) => g.deadline != null && g.status === "active")
    .map((g) => ({ g, d: daysBetween(today, g.deadline as string) }))
    .filter(({ d }) => d <= 7)
    .sort((a, b) => a.d - b.d)
    .map(({ g, d }) => (d < 0 ? `• ${esc(g.title)} — deadline passed, did you make it? Open Goals.` : `• ${esc(g.title)} — deadline ${whenLabel(d)}`));
  if (goalLines.length) lines.push("", "🎯 <b>Goals</b>", ...goalLines);

  if (s.important.length) {
    lines.push("", "📅 <b>This week</b>");
    for (const d of [...s.important].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)) {
      lines.push(`${KIND_ICON[d.kind] ?? "📌"} ${esc(d.title)} — ${whenLabel(daysBetween(today, d.date))}`);
    }
  }

  const habits = habitsDueToday(s);
  if (habits.length) lines.push("", `🔁 ${habits.length} habit${habits.length > 1 ? "s" : ""} today: ${habits.map((h) => esc(h.name)).slice(0, 5).join(", ")}`);

  return { text: lines.join("\n"), buttons: doneButtons([...overdue.slice(0, 2), ...dueToday].slice(0, 5)) };
}

/**
 * The afternoon check: what's left of today, with the next block. Null when
 * the day is already handled — no news is no message.
 */
export function midday(s: Snapshot): Message | null {
  const today = s.now.date;
  const open = s.tasks.filter((t) => t.due_date === today).sort(byUrgency);
  const overdue = s.tasks.filter((t) => t.due_date != null && t.due_date < today);
  const blocks = s.plan.filter((p) => p.date === today);
  const done = blocks.filter((b) => b.done).length;
  const next = blocks.find((p) => !p.done && p.start_time && toMins(p.start_time) >= s.now.mins);
  if (open.length === 0 && overdue.length === 0 && !next) return null;

  const lines = ["🕐 <b>Afternoon check</b>"];
  if (blocks.length) lines.push(`Plan: ${done}/${blocks.length} blocks done${done === 0 && s.now.hour >= 14 ? " — time to start." : "."}`);
  if (next) lines.push(`Next: <b>${esc(next.title)}</b> at ${hm(next.start_time)}`);
  if (open.length) {
    lines.push("", `<b>Still due today · ${open.length}</b>`);
    for (const t of open.slice(0, 6)) lines.push(`• ${PRIO_MARK[t.priority]}${esc(t.title)}${t.due_time ? ` <i>by ${hm(t.due_time)}</i>` : ""}`);
  }
  if (overdue.length) lines.push("", `⚠️ ${overdue.length} overdue still waiting.`);
  return { text: lines.join("\n"), buttons: doneButtons(open) };
}

/** The evening check. Null when there is nothing worth a ping. */
export function evening(s: Snapshot): Message | null {
  const today = s.now.date;
  const tomorrow = addDays(today, 1);
  const lines: string[] = ["🌙 <b>Evening check</b>"];
  const buttons: InlineButton[][] = [];

  const open = s.tasks.filter((t) => t.due_date === today).sort(byUrgency);
  if (open.length) {
    lines.push("", `<b>Still open today · ${open.length}</b>`);
    for (const t of open.slice(0, 6)) lines.push(`• ${esc(t.title)}`);
    lines.push("<i>Done? Tick it. Not happening? Move it to tomorrow.</i>");
    for (const t of open.slice(0, 4)) {
      buttons.push([
        { text: `✓ ${shortTitle(t.title, 20)}`, callback_data: `done:${t.id}` },
        { text: "📅 Tomorrow", callback_data: `tmr:${t.id}` },
      ]);
    }
  }

  const blocks = s.plan.filter((p) => p.date === today);
  const missed = blocks.filter((p) => !p.done);
  if (blocks.length) lines.push("", `Plan: ${blocks.length - missed.length}/${blocks.length} blocks ticked.`);

  const habits = habitsDueToday(s).filter((h) => !s.habitsDone.includes(h.id));
  if (habits.length) {
    lines.push("", `🔁 Habits left: ${habits.map((h) => esc(h.name)).slice(0, 6).join(", ")} — tap the ones you did.`);
    buttons.push(...habitButtons(habits));
  }
  if (!s.gym) buttons.push([{ text: "🏋️ Went to the gym today", callback_data: `gym:${s.now.date}` }]);

  const due = s.tasks.filter((t) => t.due_date === tomorrow).sort(byUrgency);
  const goalsTomorrow = s.goals.filter((g) => g.deadline === tomorrow);
  const daysTomorrow = s.important.filter((d) => d.date === tomorrow);
  const planTomorrow = s.plan.filter((p) => p.date === tomorrow);
  if (due.length || goalsTomorrow.length || daysTomorrow.length || planTomorrow.length) {
    lines.push("", "<b>Tomorrow</b>");
    if (planTomorrow.length) lines.push(`${planTomorrow.length} block${planTomorrow.length > 1 ? "s" : ""} planned, first at ${hm(planTomorrow.find((p) => p.start_time)?.start_time ?? null) || "—"}`);
    for (const t of due.slice(0, 6)) lines.push(`• ${PRIO_MARK[t.priority]}${esc(t.title)}${t.due_time ? ` <i>by ${hm(t.due_time)}</i>` : ""}`);
    for (const g of goalsTomorrow) lines.push(`🎯 Goal deadline: ${esc(g.title)}`);
    for (const d of daysTomorrow) lines.push(`${KIND_ICON[d.kind] ?? "📌"} ${esc(d.title)}`);
  } else {
    lines.push("", "Tomorrow is empty — plan it tonight and you start ahead.");
  }

  if (!s.journaled) lines.push("", "📓 Journal's empty today — three lines before bed?");

  if (open.length === 0 && habits.length === 0 && missed.length === 0 && s.journaled && due.length === 0) return null;
  return { text: lines.join("\n"), buttons };
}

/* ------------------------------- Reminders -------------------------------- */

export interface Ping extends Message {
  key: string;
}

/**
 * Time-sensitive reminders, checked every tick:
 *  - timed tasks: 3 hours before (urgent/high), 1 hour before, and 15 minutes before;
 *  - blocks: as they start, and a "did you do it?" just after they end;
 *  - important days and goal deadlines: the day before.
 */
export function soon(s: Snapshot, link: Link): Ping[] {
  const today = s.now.date;
  const out: Ping[] = [];

  for (const t of s.tasks) {
    if (t.due_date !== today || !t.due_time) continue;
    const left = toMins(t.due_time) - s.now.mins;
    const step =
      left > 150 && left <= 180 && (t.priority === "urgent" || t.priority === "high")
        ? "3h"
        : left > 30 && left <= 60
          ? "1h"
          : left > 0 && left <= 20
            ? "15m"
            : null;
    if (!step) continue;
    out.push({
      key: `task-${step}:${t.id}:${today}`,
      text:
        step === "15m"
          ? `🚨 <b>${esc(t.title)}</b> — due at ${hm(t.due_time)}, ${left} min left.`
          : `⏰ <b>${esc(t.title)}</b> is due at ${hm(t.due_time)} — ${duration(left)} left.`,
      buttons: taskActions(t),
    });
  }

  if (link.notify_blocks) {
    for (const b of s.plan) {
      if (b.date !== today || !b.start_time) continue;
      const start = toMins(b.start_time);
      const end = start + b.minutes;
      const left = start - s.now.mins;
      if (!b.done && left >= -5 && left <= 10) {
        out.push({
          key: `block:${b.id}`,
          text: `▶️ ${left > 0 ? `In ${left} min` : "Now"}: <b>${esc(b.title)}</b> · ${hm(b.start_time)}–${clock(end)} (${duration(b.minutes)})`,
          buttons: [[{ text: "✓ Done", callback_data: `block:${b.id}` }, { text: "+15 min", callback_data: `bext:${b.id}` }]],
        });
      }
      const since = s.now.mins - end;
      if (!b.done && since >= 0 && since <= 25 && b.minutes >= 20) {
        out.push({
          key: `block-end:${b.id}`,
          text: `⏹ <b>${esc(b.title)}</b> just ended. Did you do it?`,
          buttons: [[{ text: "✓ Yes, done", callback_data: `block:${b.id}` }, { text: "+15 min", callback_data: `bext:${b.id}` }, { text: "✗ Skipped", callback_data: `bskip:${b.id}` }]],
        });
      }
    }
  }

  // The day before: an evening heads-up for dates that matter.
  if (s.now.hour >= 18 && s.now.hour < 21) {
    const tomorrow = addDays(today, 1);
    for (const d of s.important) {
      if (d.date !== tomorrow) continue;
      out.push({ key: `day-before:${d.id}:${tomorrow}`, text: `${KIND_ICON[d.kind] ?? "📌"} Tomorrow: <b>${esc(d.title)}</b>. Anything to prepare tonight?` });
    }
  }

  return out;
}

function clock(m: number): string {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}

/* ---------------------------------- Goals --------------------------------- */

function quietDays(g: GoalRow, today: string): number {
  const pushes = g.extras?.pushes ?? [];
  const last = [g.created_at.slice(0, 10), ...pushes].sort().at(-1) as string;
  return daysBetween(last, today);
}

function pushStreak(pushes: string[], today: string): number {
  const set = new Set(pushes);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

/**
 * The goal nudge: one goal a day, leaning towards the one you've neglected
 * or whose deadline is near, with your own reason for it read back to you.
 */
export function goalNudge(s: Snapshot): Message | null {
  const today = s.now.date;
  const live = s.goals.filter((g) => g.status === "active" && !(g.extras?.pushes ?? []).includes(today));
  if (live.length === 0) return null;
  const score = (g: GoalRow) => {
    const due = g.deadline ? Math.max(0, 60 - daysBetween(today, g.deadline)) / 60 : 0;
    const pr = { urgent: 1.6, high: 1.3, medium: 1, low: 0.7 }[g.priority] ?? 1;
    const seed = (Date.parse(today) / 86_400_000 + g.id.charCodeAt(0)) % 7;
    return (1 + Math.min(14, quietDays(g, today)) / 5 + due * 2) * pr + seed / 10;
  };
  const g = [...live].sort((a, b) => score(b) - score(a))[0];

  const reasons = [
    g.note && { label: "Why it matters", text: g.note },
    g.extras?.reward && { label: "When you get there", text: g.extras.reward },
    g.extras?.cost && { label: "If you let it go", text: g.extras.cost },
    g.extras?.mantra && { label: "Your line", text: g.extras.mantra },
  ].filter(Boolean) as { label: string; text: string }[];
  const reason = reasons.length ? reasons[Math.floor(Date.parse(today) / 86_400_000) % reasons.length] : null;

  const lines = [`🎯 <b>${esc(g.title)}</b>`];
  if (g.deadline) {
    const d = daysBetween(today, g.deadline);
    lines.push(d >= 0 ? `⏳ ${d === 0 ? "Deadline is today" : `${d} days left`}` : `Deadline passed ${-d}d ago`);
  }
  const quiet = quietDays(g, today);
  const streak = pushStreak(g.extras?.pushes ?? [], today);
  if (streak > 0) lines.push(`🔥 ${streak}-day push streak — keep it alive.`);
  else if (quiet >= 3) lines.push(`Untouched for ${quiet} days.`);
  if (reason) lines.push("", `<i>${esc(reason.label)}:</i> “${esc(reason.text.slice(0, 220))}”`);
  const next = g.extras?.milestones?.find((m) => !m.done);
  if (next) lines.push("", `Next step: <b>${esc(next.text)}</b>`);
  lines.push("", "Did you do something for it today?");

  return { text: lines.join("\n"), buttons: [[{ text: "🔥 I pushed today", callback_data: `push:${g.id}` }]] };
}

/** /goals: every live goal with its countdown and streak. */
export function goalsView(s: Snapshot): Message {
  const today = s.now.date;
  const live = s.goals.filter((g) => g.status === "active");
  if (live.length === 0) return { text: "🎯 No active goals. Set one in Lock In → Goals." };
  const lines = ["🎯 <b>Your goals</b>"];
  const buttons: InlineButton[][] = [];
  for (const g of live.slice(0, 8)) {
    const pushes = g.extras?.pushes ?? [];
    const streak = pushStreak(pushes, today);
    const bits = [
      g.deadline ? (daysBetween(today, g.deadline) >= 0 ? `${daysBetween(today, g.deadline)}d left` : "deadline passed") : null,
      streak > 0 ? `🔥${streak}` : null,
      pushes.includes(today) ? "pushed today ✓" : null,
    ].filter(Boolean);
    lines.push(`• <b>${esc(g.title)}</b>${bits.length ? ` — ${bits.join(" · ")}` : ""}`);
    if (!pushes.includes(today)) buttons.push([{ text: `🔥 Pushed: ${shortTitle(g.title, 22)}`, callback_data: `push:${g.id}` }]);
  }
  return { text: lines.join("\n"), buttons: buttons.slice(0, 6) };
}

/* ---------------------------------- Views --------------------------------- */

/** /plan and /tomorrow: one day's blocks, with tick buttons for today. */
export function planView(s: Snapshot, which: "today" | "tomorrow"): Message {
  const date = which === "today" ? s.now.date : addDays(s.now.date, 1);
  const blocks = s.plan.filter((p) => p.date === date);
  if (blocks.length === 0) {
    return { text: `🗓 Nothing planned for ${which}. Add one: <code>/block gym 18:00 60</code>` };
  }
  const lines = [`🗓 <b>${which === "today" ? "Today" : "Tomorrow"}</b> — ${weekday(date)}`, ""];
  for (const b of blocks) {
    const now = which === "today" && b.start_time && !b.done && toMins(b.start_time) <= s.now.mins && toMins(b.start_time) + b.minutes > s.now.mins;
    lines.push(
      `${b.done ? "✅" : now ? "▶️" : "▫️"} ${b.start_time ? `<code>${hm(b.start_time)}–${clock(toMins(b.start_time) + b.minutes)}</code> ` : ""}${b.done ? `<s>${esc(b.title)}</s>` : esc(b.title)}${now ? " <i>(now)</i>" : ""}`,
    );
  }
  const left = blocks.filter((b) => !b.done);
  const buttons =
    which === "today" ? left.slice(0, 6).map((b) => [{ text: `✓ ${shortTitle(b.title)}`, callback_data: `block:${b.id}` }]) : undefined;
  return { text: lines.join("\n"), buttons };
}

/** /tasks: open tasks, most pressing first, with tick buttons. */
export function tasksView(s: Snapshot): Message {
  const today = s.now.date;
  const open = [...s.tasks].sort(byUrgency);
  if (open.length === 0) return { text: "✅ No open tasks. Send me a message to add one." };
  const dated = open.filter((t) => t.due_date);
  const undated = open.filter((t) => !t.due_date);
  const lines = [`📌 <b>Open tasks · ${open.length}</b>`, ""];
  for (const t of dated.slice(0, 10)) {
    const d = daysBetween(today, t.due_date as string);
    lines.push(`• ${PRIO_MARK[t.priority]}${esc(t.title)} — <i>${whenLabel(d)}${t.due_time ? ` ${hm(t.due_time)}` : ""}</i>`);
  }
  if (undated.length) lines.push("", `<i>+ ${undated.length} without a date</i>`);
  return { text: lines.join("\n"), buttons: doneButtons(dated.length ? dated : undated) };
}

/** /habits: today's habits as buttons. */
export function habitsView(s: Snapshot): Message {
  const due = habitsDueToday(s);
  if (due.length === 0) return { text: "🔁 No habits due today." };
  const left = due.filter((h) => !s.habitsDone.includes(h.id));
  const lines = [`🔁 <b>Habits today · ${due.length - left.length}/${due.length}</b>`, ""];
  for (const h of due) lines.push(`${s.habitsDone.includes(h.id) ? "✅" : "▫️"} ${esc(h.name)}`);
  return { text: lines.join("\n"), buttons: habitButtons(left) };
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
  const overdue = s.tasks.filter((t) => t.due_date != null && t.due_date < today).length;
  if (byDay.size === 0) return { text: `📆 Nothing dated in the next 7 days.${overdue ? `\n⚠️ ${overdue} overdue though — /tasks` : ""}` };
  const lines = ["📆 <b>Next 7 days</b>"];
  if (overdue) lines.push(`⚠️ ${overdue} overdue — /tasks`);
  for (const d of [...byDay.keys()].sort()) lines.push("", `<b>${weekday(d)}</b> · ${whenLabel(daysBetween(today, d))}`, ...(byDay.get(d) as string[]));
  return { text: lines.join("\n") };
}

/** /next: the next block and the most pressing task. */
export function next(s: Snapshot): Message {
  const today = s.now.date;
  const block = s.plan.find((p) => p.date === today && !p.done && p.start_time && toMins(p.start_time) + p.minutes > s.now.mins);
  const task = [...s.tasks].filter((t) => t.due_date != null && t.due_date <= addDays(today, 1)).sort(byUrgency)[0];
  const lines: string[] = [];
  if (block) {
    const start = toMins(block.start_time as string);
    lines.push(
      start <= s.now.mins
        ? `▶️ Now: <b>${esc(block.title)}</b> until ${clock(start + block.minutes)}`
        : `▶️ Next block: <b>${esc(block.title)}</b> at ${hm(block.start_time)} (in ${duration(start - s.now.mins)})`,
    );
  }
  if (task) lines.push(`📌 Most pressing: <b>${esc(task.title)}</b> — ${task.due_date === today ? `due today${task.due_time ? ` ${hm(task.due_time)}` : ""}` : (task.due_date as string) < today ? "overdue" : "due tomorrow"}`);
  if (!lines.length) lines.push("Nothing pressing. Good time to get ahead.");
  return { text: lines.join("\n"), buttons: task ? taskActions(task) : undefined };
}
