"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase/client";
import { Button, Panel } from "./ui";

/**
 * Connect a Telegram chat for reminders.
 *
 * Linking never asks for anything secret: this writes a random one-time code
 * to your own row, opens the bot with it, and the bot (server side) claims the
 * row. The page polls until the chat shows up.
 */

interface Row {
  chat_id: number | null;
  username: string | null;
  timezone: string;
  morning_hour: number;
  evening_hour: number;
  notify_blocks: boolean;
  paused: boolean;
}

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function db(): SupabaseClient | null {
  return getSupabase() as unknown as SupabaseClient | null;
}

function code(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function TelegramSection() {
  const store = useStore();
  const [row, setRow] = useState<Row | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const client = db();
    if (!client) return null;
    const { data, error } = await client
      .from("telegram_links")
      .select("chat_id,username,timezone,morning_hour,evening_hour,notify_blocks,paused")
      .maybeSingle();
    if (error) setError("Telegram isn't set up on the server yet (migration 012).");
    setRow((data as Row | null) ?? null);
    setLoaded(true);
    return (data as Row | null) ?? null;
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [load]);

  const connect = async () => {
    const client = db();
    if (!client || !BOT) return;
    setError(null);
    const c = code();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Almaty";
    const expires = new Date(Date.now() + 15 * 60_000).toISOString();
    const res = row
      ? await client.from("telegram_links").update({ link_code: c, code_expires_at: expires, timezone: tz }).eq("user_id", store.user?.id ?? "")
      : await client.from("telegram_links").insert({ link_code: c, code_expires_at: expires, timezone: tz });
    if (res.error) {
      setError("Couldn't start linking. Is migration 012 applied?");
      return;
    }
    window.open(`https://t.me/${BOT}?start=${c}`, "_blank", "noopener");
    setWaiting(true);
    const started = Date.now();
    if (poll.current) clearInterval(poll.current);
    poll.current = setInterval(async () => {
      const r = await load();
      if (r?.chat_id || Date.now() - started > 15 * 60_000) {
        if (poll.current) clearInterval(poll.current);
        setWaiting(false);
      }
    }, 3000);
  };

  const patch = async (p: Partial<Row>) => {
    const client = db();
    if (!client || !row) return;
    setRow({ ...row, ...p });
    const { error } = await client.from("telegram_links").update(p).eq("user_id", store.user?.id ?? "");
    if (error) {
      setError("Couldn't save that.");
      void load();
    }
  };

  const disconnect = async () => {
    const client = db();
    if (!client) return;
    await client.from("telegram_links").delete().eq("user_id", store.user?.id ?? "");
    setRow(null);
  };

  if (store.backend !== "cloud") {
    return (
      <Panel className="px-4 py-4 text-sm text-ink-2">
        Telegram reminders need account sync — the bot reads your deadlines from the cloud.
      </Panel>
    );
  }
  if (!BOT) {
    return (
      <Panel className="px-4 py-4 text-sm text-ink-2">
        The bot isn&apos;t configured on this deployment yet (<code className="text-xs">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>).
      </Panel>
    );
  }
  if (!loaded) return <Panel className="h-20">{null}</Panel>;

  const linked = row?.chat_id != null;

  return (
    <Panel className="grid gap-4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#229ED9] text-white">
            <svg viewBox="0 0 24 24" aria-hidden className="size-5">
              <path d="M21.5 4.2 2.9 11.4c-1 .4-1 1.6 0 1.9l4.6 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.8 3.5c.6.4 1.4.1 1.6-.6L22.9 5.6c.2-1-.6-1.8-1.4-1.4ZM9.6 14.2l8.6-6.9-6.9 8-.3 3.1-1.4-4.2Z" fill="currentColor" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {linked ? <>Connected{row?.username ? <span className="font-normal text-ink-3"> · @{row.username}</span> : null}</> : "Telegram reminders"}
            </p>
            <p className="text-xs text-ink-3">
              {linked
                ? row?.paused
                  ? "Paused — commands still work."
                  : "Morning brief, evening check, deadline and block heads-ups."
                : "Get your day, deadlines and reminders in Telegram. Tick tasks done from the chat."}
            </p>
          </div>
        </div>
        {linked ? (
          <Button variant="ghost" onClick={() => void disconnect()}>
            Disconnect
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void connect()} disabled={waiting}>
            {waiting ? "Waiting for Telegram…" : "Connect"}
          </Button>
        )}
      </div>

      {waiting && (
        <p className="text-xs text-ink-2">
          Telegram opened — press <b>Start</b> in the bot. This updates by itself.
        </p>
      )}
      {error && <p className="text-xs text-[var(--urgent)]">{error}</p>}

      {linked && row && (
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <HourPick label="Morning brief" value={row.morning_hour} onChange={(h) => void patch({ morning_hour: h })} />
          <HourPick label="Evening check" value={row.evening_hour} onChange={(h) => void patch({ evening_hour: h })} />
          <Toggle label="Block reminders" hint="A ping as each plan block starts" on={row.notify_blocks} onChange={(v) => void patch({ notify_blocks: v })} />
          <Toggle label="Pause everything" hint="Stop scheduled messages" on={row.paused} onChange={(v) => void patch({ paused: v })} />
          <p className="text-[11px] text-ink-3 sm:col-span-2">Times are in {row.timezone}.</p>
        </div>
      )}
    </Panel>
  );
}

function HourPick({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="nums rounded-md bg-panel-2 px-2 py-1 text-sm"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {`${h}`.padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:bg-panel-2"
    >
      <span>
        <span className="block text-sm font-medium text-ink-2">{label}</span>
        <span className="block text-[11px] text-ink-3">{hint}</span>
      </span>
      <span aria-hidden className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-[var(--border-strong)]"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left] duration-200 ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
