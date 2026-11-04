import { adminDb, esc, sameSecret, send, tg } from "@/lib/telegram/server";
import { Link, localNow, next, snapshot, week, morning } from "@/lib/telegram/digest";
import { parseQuickAdd } from "@/lib/quickparse";
import type { Course } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Telegram calls this for every message and button press. It answers 200
 * whatever happens: a non-200 makes Telegram retry the same update for hours.
 */

interface Update {
  message?: { chat: { id: number }; from?: { username?: string }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
}

const HELP = [
  "<b>Locked In bot</b>",
  "",
  "/today — the brief for today",
  "/next — next block and most pressing task",
  "/week — deadlines in the next 7 days",
  "/add <i>text</i> — add a task, e.g. <code>/add essay draft friday 5pm important</code>",
  "/pause · /resume — stop or restart reminders",
  "/unlink — disconnect this chat",
  "",
  "Or just send a message — it becomes a task.",
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
      await send(chatId, "That link has expired. Open Locked In → Settings → Telegram and press Connect again.");
      return;
    }
    // A chat belongs to one account: free it from any previous one first.
    await db.from("telegram_links").update({ chat_id: null }).eq("chat_id", chatId).neq("user_id", data.user_id);
    await db
      .from("telegram_links")
      .update({ chat_id: chatId, username: username ?? null, link_code: null, code_expires_at: null, linked_at: new Date().toISOString(), paused: false })
      .eq("user_id", data.user_id);
    await send(chatId, `✅ <b>Connected.</b> You'll get a brief every morning, an evening check, and heads-ups before deadlines and blocks.\n\n${HELP}`);
    return;
  }

  const link = await linkFor(chatId);
  if (!link) {
    await send(chatId, "This chat isn't connected yet. Open Locked In → Settings → Telegram and press <b>Connect</b>.");
    return;
  }

  switch (cmd) {
    case "start":
    case "help":
      await send(chatId, HELP);
      return;
    case "today": {
      const m = morning(await snapshot(db, link));
      await send(chatId, m.text.replace("☀️ <b>Good morning</b>", "📋 <b>Today</b>"), m.buttons);
      return;
    }
    case "next": {
      const m = next(await snapshot(db, link));
      await send(chatId, m.text, m.buttons);
      return;
    }
    case "week":
      await send(chatId, week(await snapshot(db, link)).text);
      return;
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
      await send(chatId, HELP);
  }
}

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
  const bits = [
    parsed.dueDate ? `📅 ${parsed.dueDate === today ? "today" : parsed.dueDate}${parsed.dueTime ? ` ${parsed.dueTime}` : ""}` : "no date",
    parsed.priority !== "medium" ? parsed.priority : null,
    parsed.courseId ? (courses ?? []).find((c) => c.id === parsed.courseId)?.name : null,
  ].filter(Boolean);
  await send(chatId, `➕ Added <b>${esc(title)}</b>\n<i>${esc(bits.join(" · "))}</i>`, [
    [{ text: "✓ Done", callback_data: `done:${data.id}` }],
  ]);
}

async function onButton(q: NonNullable<Update["callback_query"]>) {
  const db = adminDb()!;
  const chatId = q.message?.chat.id;
  const link = chatId != null ? await linkFor(chatId) : null;
  const [kind, id] = (q.data ?? "").split(":");
  if (!link || !id) {
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Not connected." });
    return;
  }
  const today = localNow(link.timezone).date;
  let label = "Done ✓";
  if (kind === "done") {
    const { data } = await db
      .from("tasks")
      .update({ status: "completed", completed_at: today })
      .eq("id", id)
      .eq("user_id", link.user_id)
      .select("title")
      .maybeSingle();
    label = data ? `Done: ${data.title}` : "Already gone.";
  } else if (kind === "block") {
    const { data } = await db
      .from("plan_items")
      .update({ done: true })
      .eq("id", id)
      .eq("user_id", link.user_id)
      .select("title")
      .maybeSingle();
    label = data ? `Ticked: ${data.title}` : "Already gone.";
  }
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: label.slice(0, 190) });
}
