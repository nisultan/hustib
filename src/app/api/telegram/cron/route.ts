import { adminDb, sameSecret, send } from "@/lib/telegram/server";
import { evening, Link, morning, snapshot, soon } from "@/lib/telegram/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The scheduler's tick. Something outside calls this every ~10 minutes (a
 * GitHub Actions workflow, see .github/workflows/telegram.yml) with
 * `Authorization: Bearer $CRON_SECRET`. Each tick looks at every linked chat
 * and sends whatever is due *now* in that person's own timezone:
 *
 *  - the morning brief, once, in the hour they chose (or the two after, in
 *    case a tick was skipped);
 *  - the evening check, the same way, only when there is something to say;
 *  - "due in N min" for timed tasks, and "starting now" for plan blocks.
 *
 * Every message is claimed in `telegram_sent` before it is sent, so two
 * overlapping ticks can never send the same thing twice.
 */
async function run(request: Request) {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!sameSecret(auth, process.env.CRON_SECRET)) return new Response("forbidden", { status: 403 });
  const db = adminDb();
  if (!db) return Response.json({ error: "Supabase service role is not configured" }, { status: 500 });

  const { data: links } = await db
    .from("telegram_links")
    .select("user_id,chat_id,timezone,morning_hour,evening_hour,notify_blocks,paused")
    .not("chat_id", "is", null)
    .eq("paused", false);

  let sent = 0;
  for (const link of (links ?? []) as Link[]) {
    try {
      const s = await snapshot(db, link);
      const claim = async (key: string) => {
        const { error } = await db.from("telegram_sent").insert({ user_id: link.user_id, key });
        return !error; // a duplicate key means it already went out
      };
      const inWindow = (h: number) => s.now.hour >= h && s.now.hour < h + 3;

      if (inWindow(link.morning_hour) && (await claim(`morning:${s.now.date}`))) {
        const m = morning(s);
        await send(link.chat_id, m.text, m.buttons);
        sent += 1;
      }
      if (inWindow(link.evening_hour)) {
        const m = evening(s);
        if (m && (await claim(`evening:${s.now.date}`))) {
          await send(link.chat_id, m.text, m.buttons);
          sent += 1;
        }
      }
      for (const p of soon(s, link)) {
        if (await claim(p.key)) {
          await send(link.chat_id, p.text, p.buttons);
          sent += 1;
        }
      }
    } catch (e) {
      console.error("[telegram] tick failed for a user:", e);
    }
  }

  // Keep the log small: nothing older than two weeks matters.
  await db.from("telegram_sent").delete().lt("sent_at", new Date(Date.now() - 14 * 86_400_000).toISOString());

  return Response.json({ users: links?.length ?? 0, sent });
}

export const GET = run;
export const POST = run;
