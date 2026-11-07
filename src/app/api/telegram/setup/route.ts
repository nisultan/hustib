import { sameSecret, tg } from "@/lib/telegram/server";

export const dynamic = "force-dynamic";

/**
 * One-off: points the bot at this deployment's webhook and registers the
 * command menu. Run it once after the env vars are set:
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/telegram/setup
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!sameSecret(auth, process.env.CRON_SECRET)) return new Response("forbidden", { status: 403 });
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return Response.json({ error: "TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be set" }, { status: 500 });
  }
  const origin = new URL(request.url).origin;
  const webhook = await tg("setWebhook", {
    url: `${origin}/api/telegram/webhook`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const commands = await tg("setMyCommands", {
    commands: [
      { command: "today", description: "Full brief for today" },
      { command: "plan", description: "Today's plan" },
      { command: "tomorrow", description: "Tomorrow's plan" },
      { command: "next", description: "What's now and most pressing" },
      { command: "tasks", description: "Open tasks — tick them here" },
      { command: "week", description: "Next 7 days" },
      { command: "goals", description: "Goals and push streaks" },
      { command: "habits", description: "Tick today's habits" },
      { command: "block", description: "Add a plan block: /block gym 18:00 60" },
      { command: "add", description: "Add a task" },
      { command: "pause", description: "Pause reminders" },
      { command: "resume", description: "Resume reminders" },
      { command: "help", description: "What I can do" },
    ],
  });
  const me = await tg<{ username: string }>("getMe", {});
  return Response.json({ webhook: webhook === true, commands: commands === true, bot: me?.username ?? null, url: `${origin}/api/telegram/webhook` });
}
