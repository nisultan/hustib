import { adminDb, esc, InlineButton, sameSecret, send, tg } from "@/lib/telegram/server";
import {
  goalsView,
  habitsView,
  Link,
  localNow,
  morning,
  next,
  planView,
  snapshot,
  tasksView,
  week,
} from "@/lib/telegram/digest";
import { addDays } from "@/lib/dates";
import { startOfWeek } from "@/lib/calendar";
import { parseQuickAdd } from "@/lib/quickparse";
import type { Course } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Telegram calls this for every message and button press. It answers 200
 * whatever happens: a non-200 makes Telegram retry the same update for hours.
 */

interface Update {
  message?: { chat: { id: number }; from?: { username?: string }; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number; reply_markup?: { inline_keyboard: InlineButton[][] } };
  };
}

const HELP = [
  "<b>Lock In bot</b>",
  "",
  "<b>Look</b>",
  "/today — the full brief for today",
  "/plan · /tomorrow — the day's blocks",
  "/next — what's now and what's most pressing",
  "/tasks — open tasks, tick them here",
  "/week — everything dated in the next 7 days",
  "/goals — goals, streaks, “I pushed today”",
  "/habits — tick today's habits",
  "",
  "<b>Add</b>",
  "Just send a message — it becomes a task:",
  "<code>physics IA draft friday 17:00 important</code>",
  "/block <i>title time [length]</i> — add a plan block:",
  "<code>/block gym 18:00 60</code> · <code>/block read tomorrow 21:30</code>",
  "/gym — mark today as a gym day",
  "/weight <i>72.4</i> — log this morning's weight",
  "",
  "<b>Reminders</b> — morning brief, afternoon check, evening check, deadlines (3h · 1h · 15m), blocks as they start and end, one goal a day.",
  "/pause · /resume — stop or restart them",
  "/unlink — disconnect this chat",
].join("\n");

const ok = () => new Response("ok");

export async function POST(request: Request) {
  if (!sameSecret(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("forbidden", { status: 403 });
  }
  const db = adminDb();
  if (!db) return ok();

  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return ok();
  }

  try {
    if (update.callback_query) await onButton(update.callback_query);
    else if (update.message?.text) await onText(update.message.chat.id, update.message.text.trim(), update.message.from?.username);
  } catch (e) {
    console.error("[telegram] webhook failed:", e);
  }
  return ok();
}

async function linkFor(chatId: number): Promise<Link | null> {
  const db = adminDb();
  if (!db) return null;
  const { data } = await db.from("telegram_links").select("*").eq("chat_id", chatId).maybeSingle();
  return (data as Link | null) ?? null;
}

async function onText(chatId: number, text: string, username?: string) {
  const db = adminDb()!;
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.startsWith("/") ? cmdRaw.slice(1).split("@")[0].toLowerCase() : "";
  const arg = rest.join(" ").trim();

  if (cmd === "start" && arg) {
    const { data } = await db
      .from("telegram_links")
      .select("user_id, code_expires_at")
      .eq("link_code", arg)
      .maybeSingle();
    if (!data || !data.code_expires_at || Date.parse(data.code_expires_at) < Date.now()) {
      await send(chatId, "That link has expired. Open Lock In → Settings → Telegram and press Connect again.");
      return;
    }
    // A chat belongs to one account: free it from any previous one first.
    await db.from("telegram_links").update({ chat_id: null }).eq("chat_id", chatId).neq("user_id", data.user_id);
    await db
      .from("telegram_links")
      .update({ chat_id: chatId, username: username ?? null, link_code: null, code_expires_at: null, linked_at: new Date().toISOString(), paused: false })
      .eq("user_id", data.user_id);
    await send(chatId, `✅ <b>Connected.</b>\n\n${HELP}`);
    return;
  }

  const link = await linkFor(chatId);
  if (!link) {
    await send(chatId, "This chat isn't connected yet. Open Lock In → Settings → Telegram and press <b>Connect</b>.");
    return;
  }

  const show = async (build: (s: Awaited<ReturnType<typeof snapshot>>) => { text: string; buttons?: InlineButton[][] }) => {
    const m = build(await snapshot(db, link));
    await send(chatId, m.text, m.buttons);
  };

  switch (cmd) {
    case "start":
    case "help":
      await send(chatId, HELP);
      return;
    case "today":
      return show((s) => {
        const m = morning(s);
        return { ...m, text: m.text.replace("☀️ <b>Good morning</b>", "📋 <b>Today</b>") };
      });
    case "plan":
      return show((s) => planView(s, "today"));
    case "tomorrow":
      return show((s) => planView(s, "tomorrow"));
    case "next":
    case "now":
      return show(next);
    case "tasks":
    case "todo":
      return show(tasksView);
    case "week":
      return show(week);
    case "goals":
      return show(goalsView);
    case "habits":
      return show(habitsView);
    case "block":
      await addBlock(link, chatId, arg);
      return;
    case "gym": {
      const today = localNow(link.timezone).date;
      const { error } = await db.from("days").upsert({ user_id: link.user_id, date: today, gym: true }, { onConflict: "user_id,date" });
      if (error) {
        console.error("[telegram] gym failed:", error.message);
        await send(chatId, "Couldn't save it — gym days need migration 014_gym.sql in Supabase.");
        return;
      }
      await send(chatId, `🏋️ <b>Gym day logged.</b> ${await gymWeek(link.user_id, today)}`, [
        [{ text: "↩️ Undo", callback_data: `gymx:${today}` }],
      ]);
      return;
    }
    case "weight":
    case "w": {
      const kg = Number(arg.replace(",", ".").replace(/[^\d.]/g, ""));
      if (!(kg > 20 && kg < 400)) {
        await send(chatId, "Send it like <code>/weight 72.4</code>.");
        return;
      }
      const today = localNow(link.timezone).date;
      const { data: prev } = await db
        .from("days")
        .select("weight,date")
        .eq("user_id", link.user_id)
        .lt("date", today)
        .not("weight", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await db.from("days").upsert({ user_id: link.user_id, date: today, weight: kg }, { onConflict: "user_id,date" });
      if (error) {
        console.error("[telegram] weight failed:", error.message);
        await send(chatId, "Couldn't save that. Try again in a moment.");
        return;
      }
      const delta = prev?.weight != null ? kg - Number(prev.weight) : null;
      await send(
        chatId,
        `⚖️ <b>${kg.toFixed(1)} kg</b> logged${delta != null ? ` (${delta > 0 ? "+" : ""}${delta.toFixed(1)} since ${prev!.date})` : ""}.`,
      );
      return;
    }
    case "pause":
      await db.from("telegram_links").update({ paused: true }).eq("user_id", link.user_id);
      await send(chatId, "⏸ Reminders paused. /resume when you want them back. Commands still work.");
      return;
    case "resume":
      await db.from("telegram_links").update({ paused: false }).eq("user_id", link.user_id);
      await send(chatId, "▶️ Reminders back on.");
      return;
    case "unlink":
    case "stop":
      await db.from("telegram_links").delete().eq("user_id", link.user_id);
      await send(chatId, "Disconnected. Reconnect any time from Settings.");
      return;
    case "add":
      if (!arg) {
        await send(chatId, "What should I add? e.g. <code>/add physics worksheet tomorrow important</code>");
        return;
      }
      await addTask(link, chatId, arg);
      return;
    case "":
      await addTask(link, chatId, text);
      return;
    default:
      await send(chatId, `I don't know /${esc(cmd)}.\n\n${HELP}`);
  }
}

/* ---------------------------------- Adding -------------------------------- */

async function addTask(link: Link, chatId: number, text: string) {
  const db = adminDb()!;
  const { data: courses } = await db.from("courses").select("id,name,code").eq("user_id", link.user_id);
  const today = localNow(link.timezone).date;
  const parsed = parseQuickAdd(
    text,
    ((courses ?? []) as { id: string; name: string; code: string }[]).map((c) => ({ ...c, color: "", lessons: [] }) as Course),
    today,
  );
  const title = parsed.title.trim() || text.trim();
  const { data, error } = await db
    .from("tasks")
    .insert({
      user_id: link.user_id,
      title,
      course_id: parsed.courseId,
      due_date: parsed.dueDate,
      due_time: parsed.dueDate ? parsed.dueTime : null,
      priority: parsed.priority,
      status: "not_started",
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[telegram] add task failed:", error?.message);
    await send(chatId, "Couldn't add that one. Try again in a moment.");
    return;
  }
  const when = parsed.dueDate
    ? `${parsed.dueDate === today ? "today" : parsed.dueDate === addDays(today, 1) ? "tomorrow" : parsed.dueDate}${parsed.dueTime ? ` ${parsed.dueTime}` : ""}`
    : "no date";
  const bits = [
    `📅 ${when}`,
    parsed.priority !== "medium" ? parsed.priority : null,
    parsed.courseId ? (courses ?? []).find((c) => c.id === parsed.courseId)?.name : null,
  ].filter(Boolean);
  const buttons: InlineButton[][] = [[{ text: "✓ Done", callback_data: `done:${data.id}` }]];
  if (!parsed.dueDate) {
    buttons.push([
      { text: "📅 Today", callback_data: `due:${data.id}:0` },
      { text: "Tomorrow", callback_data: `due:${data.id}:1` },
      { text: "In a week", callback_data: `due:${data.id}:7` },
    ]);
  }
  buttons.push([{ text: "↩️ Undo", callback_data: `undo:${data.id}` }]);
  await send(chatId, `➕ Added <b>${esc(title)}</b>\n<i>${esc(bits.join(" · "))}</i>`, buttons);
}

/**
 * "/block gym 18:00 60", "/block read tomorrow 21:30", "/block essay 9-11".
 * Time is required; length defaults to 45 minutes.
 */
async function addBlock(link: Link, chatId: number, arg: string) {
  const db = adminDb()!;
  const today = localNow(link.timezone).date;
  let rest = ` ${arg} `;
  let date = today;
  if (/\btomorrow\b|\bзавтра\b/i.test(rest)) {
    date = addDays(today, 1);
    rest = rest.replace(/\btomorrow\b|\bзавтра\b/i, " ");
  }
  const range = rest.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?\b/);
  const single = rest.match(/\b(\d{1,2})[:.](\d{2})\b/);
  let start: number | null = null;
  let minutes = 45;
  if (range) {
    start = Number(range[1]) * 60 + Number(range[2] ?? 0);
    const end = Number(range[3]) * 60 + Number(range[4] ?? 0);
    if (end > start) minutes = end - start;
    rest = rest.replace(range[0], " ");
  } else if (single) {
    start = Number(single[1]) * 60 + Number(single[2]);
    rest = rest.replace(single[0], " ");
    const len = rest.match(/\b(\d{1,3})\s*(h|ч|hours?|m|min|мин)?\b/i);
    if (len) {
      const n = Number(len[1]);
      minutes = /^(h|ч|hour)/i.test(len[2] ?? "") ? n * 60 : n;
      rest = rest.replace(len[0], " ");
    }
  }
  const title = rest.replace(/\s+/g, " ").trim();
  if (start == null || start >= 24 * 60 || !title) {
    await send(chatId, "Give it a title and a time, e.g. <code>/block gym 18:00 60</code> or <code>/block essay 9-11</code>.");
    return;
  }
  minutes = Math.min(12 * 60, Math.max(5, minutes));
  const hhmm = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  const row = { user_id: link.user_id, date, title, start_time: hhmm, minutes, done: false };
  let { data, error } = await db.from("plan_items").insert({ ...row, priority: "medium" }).select("id").single();
  if (error) ({ data, error } = await db.from("plan_items").insert(row).select("id").single());
  if (error || !data) {
    console.error("[telegram] add block failed:", error?.message);
    await send(chatId, "Couldn't add that block. Try again in a moment.");
    return;
  }
  const endM = start + minutes;
  const end = `${String(Math.floor(endM / 60) % 24).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
  await send(chatId, `🗓 Planned <b>${esc(title)}</b> — ${date === today ? "today" : "tomorrow"} ${hhmm}–${end}. I'll ping you when it starts.`, [
    [{ text: "↩️ Undo", callback_data: `bdel:${data.id}` }],
  ]);
}

/** "3 this week." — sessions from Monday to the given day. */
async function gymWeek(uid: string, date: string): Promise<string> {
  const db = adminDb()!;
  const { count } = await db
    .from("days")
    .select("date", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("gym", true)
    .gte("date", startOfWeek(date))
    .lte("date", date);
  return count != null ? `${count} this week.` : "";
}

/* --------------------------------- Buttons -------------------------------- */

async function onButton(q: NonNullable<Update["callback_query"]>) {
  const db = adminDb()!;
  const chatId = q.message?.chat.id;
  const link = chatId != null ? await linkFor(chatId) : null;
  const [kind, id, extra] = (q.data ?? "").split(":");
  if (!link || !id) {
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Not connected." });
    return;
  }
  const uid = link.user_id;
  const now = localNow(link.timezone);
  const today = now.date;
  let label = "Done ✓";
  // What to do with the button that was pressed: drop it, or the whole keyboard.
  let consume: "button" | "row" | "all" | "none" = "button";

  switch (kind) {
    case "done": {
      const { data } = await db
        .from("tasks")
        .update({ status: "completed", completed_at: today })
        .eq("id", id)
        .eq("user_id", uid)
        .select("title")
        .maybeSingle();
      label = data ? `✓ Done: ${data.title}` : "Already gone.";
      consume = q.message?.reply_markup && q.message.reply_markup.inline_keyboard.length <= 2 ? "all" : "row";
      break;
    }
    case "block": {
      const { data } = await db.from("plan_items").update({ done: true }).eq("id", id).eq("user_id", uid).select("title").maybeSingle();
      label = data ? `✓ Ticked: ${data.title}` : "Already gone.";
      consume = q.message?.reply_markup && q.message.reply_markup.inline_keyboard.length <= 1 ? "all" : "row";
      break;
    }
    case "bskip":
      label = "Okay — left unticked.";
      consume = "all";
      break;
    case "bext": {
      const { data } = await db.from("plan_items").select("minutes,title").eq("id", id).eq("user_id", uid).maybeSingle();
      if (data) {
        await db.from("plan_items").update({ minutes: (data.minutes as number) + 15 }).eq("id", id).eq("user_id", uid);
        label = `+15 min for ${data.title}`;
      } else label = "Already gone.";
      consume = "all";
      break;
    }
    case "bdel": {
      await db.from("plan_items").delete().eq("id", id).eq("user_id", uid);
      label = "Removed from the plan.";
      consume = "all";
      break;
    }
    case "snz": {
      const mins = Math.min(24 * 60, Math.max(5, Number(extra) || 30));
      const at = Date.now() + mins * 60_000;
      await db.from("telegram_sent").insert({ user_id: uid, key: `snooze:${id}:${at}` });
      label = `⏰ I'll remind you in ${mins >= 60 ? `${mins / 60}h` : `${mins} min`}.`;
      consume = "all";
      break;
    }
    case "tmr": {
      const { data } = await db.from("tasks").update({ due_date: addDays(today, 1) }).eq("id", id).eq("user_id", uid).select("title").maybeSingle();
      label = data ? `📅 Moved to tomorrow: ${data.title}` : "Already gone.";
      consume = "row";
      break;
    }
    case "due": {
      const days = Number(extra) || 0;
      const { data } = await db.from("tasks").update({ due_date: addDays(today, days) }).eq("id", id).eq("user_id", uid).select("title").maybeSingle();
      label = data ? `📅 Due ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}` : "Already gone.";
      consume = "row";
      break;
    }
    case "undo": {
      await db.from("tasks").delete().eq("id", id).eq("user_id", uid);
      label = "↩️ Removed.";
      consume = "all";
      if (chatId != null && q.message) {
        await tg("editMessageText", { chat_id: chatId, message_id: q.message.message_id, text: "<s>Task removed.</s>", parse_mode: "HTML" });
      }
      break;
    }
    case "hab": {
      const { data: day } = await db.from("days").select("habits_done").eq("user_id", uid).eq("date", today).maybeSingle();
      const done = ((day?.habits_done ?? []) as string[]).filter((h) => h !== id);
      const { error } = await db.from("days").upsert({ user_id: uid, date: today, habits_done: [...done, id] }, { onConflict: "user_id,date" });
      const { data: habit } = await db.from("habits").select("name").eq("id", id).maybeSingle();
      label = error ? "Couldn't save that." : `🔁 Kept: ${habit?.name ?? "habit"}`;
      break;
    }
    case "gym":
    case "gymx": {
      const on = kind === "gym";
      const { error } = await db.from("days").upsert({ user_id: uid, date: id, gym: on }, { onConflict: "user_id,date" });
      label = error ? "Run migration 014 to track gym days." : on ? `🏋️ Gym day logged. ${await gymWeek(uid, id)}` : "↩️ Gym day removed.";
      consume = "all";
      break;
    }
    case "push": {
      const { data: goal, error } = await db.from("goals").select("title,extras").eq("id", id).eq("user_id", uid).maybeSingle();
      if (error || !goal) {
        label = error ? "Run migration 013 to track pushes." : "Already gone.";
        break;
      }
      const extras = (goal.extras ?? {}) as { pushes?: string[] };
      const pushes = Array.from(new Set([...(extras.pushes ?? []), today])).slice(-400);
      await db.from("goals").update({ extras: { ...extras, pushes } }).eq("id", id).eq("user_id", uid);
      label = `🔥 Pushed: ${goal.title}`;
      break;
    }
    default:
      label = "That button is from an older version — try the command again.";
      consume = "none";
  }

  await tg("answerCallbackQuery", { callback_query_id: q.id, text: label.slice(0, 190) });

  // Keep the chat honest: a pressed button goes away so it can't be pressed twice.
  if (chatId == null || !q.message || consume === "none" || kind === "undo") return;
  const keyboard = q.message.reply_markup?.inline_keyboard ?? [];
  const remaining =
    consume === "all"
      ? []
      : consume === "row"
        ? keyboard.filter((row) => !row.some((b) => b.callback_data === q.data))
        : keyboard.map((row) => row.filter((b) => b.callback_data !== q.data)).filter((row) => row.length > 0);
  await tg("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: q.message.message_id,
    reply_markup: { inline_keyboard: remaining },
  });
}
