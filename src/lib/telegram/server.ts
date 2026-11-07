import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only plumbing for the Telegram bot. Never import this from a client
 * component: it reads the service-role key and the bot token, both of which
 * would hand anyone full access if they reached the browser.
 */

let admin: SupabaseClient | null = null;

/** Supabase with the service role, for the bot and the scheduler. Bypasses RLS. */
export function adminDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

/** Calls a Bot API method. Failures are logged here, never echoed to a user. */
export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      console.error(`[telegram] ${method} failed:`, json.description);
      return null;
    }
    return json.result ?? null;
  } catch (e) {
    console.error(`[telegram] ${method} threw:`, e);
    return null;
  }
}

export function send(chatId: number, text: string, buttons?: InlineButton[][]) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(buttons && buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

/** Constant-time-ish comparison for shared secrets. */
export function sameSecret(raw: string | null | undefined, expected: string | undefined): boolean {
  // Pasted secrets often pick up a space, a newline or quotes on the way into
  // a dashboard; none of that is part of the secret.
  const clean = (s: string | null | undefined) => (s ?? "").trim().replace(/^["']|["']$/g, "");
  const a = clean(raw);
  const b = clean(expected);
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
