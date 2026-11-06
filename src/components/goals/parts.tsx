"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { prepareImage } from "@/lib/image";
import { isUrl, Reminder } from "@/lib/goals/pulse";
import { courseColor } from "@/lib/appearance";

/**
 * A cover that is more than one picture: crossfades through them with a slow
 * drift, so the card is never quite the same twice.
 */
export function Cover({
  pictures,
  y = 50,
  interval = 6000,
  dim = false,
  className = "",
  children,
}: {
  pictures: string[];
  y?: number;
  interval?: number;
  dim?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (pictures.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % pictures.length), interval);
    return () => clearInterval(t);
  }, [pictures.length, interval]);
  const src = pictures[i % Math.max(1, pictures.length)];

  return (
    <div className={`relative overflow-hidden bg-panel-2 ${className}`}>
      <AnimatePresence initial={false}>
        {src && (
          <motion.img
            key={src + i}
            src={src}
            alt=""
            referrerPolicy="no-referrer"
            className={`absolute inset-0 size-full object-cover transition-[filter] duration-500 ${dim ? "grayscale-[70%]" : ""}`}
            style={{ objectPosition: `50% ${y}%` }}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.1 }, scale: { duration: interval / 1000 + 1.5, ease: "linear" } }}
          />
        )}
      </AnimatePresence>
      {pictures.length > 1 && (
        <div className="absolute right-3 top-3 z-[2] flex gap-1">
          {pictures.map((_, k) => (
            <span
              key={k}
              className={`h-1 rounded-full bg-white transition-all duration-300 ${k === i % pictures.length ? "w-4 opacity-95" : "w-1.5 opacity-50"}`}
            />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/** A tinted stand-in when a goal has no picture. */
export function Tint({ color, className = "", children }: { color: string | null; className?: string; children?: React.ReactNode }) {
  const c = color ? courseColor(color) : "var(--accent)";
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, ${c} 55%, transparent), transparent 60%), radial-gradient(90% 80% at 100% 100%, color-mix(in srgb, ${c} 35%, transparent), transparent 60%), var(--panel-2)`,
      }}
    >
      {children}
    </div>
  );
}

const TONE: Record<Reminder["tone"], string> = {
  why: "var(--accent)",
  reward: "var(--up)",
  cost: "var(--urgent)",
  mantra: "var(--high)",
};

/** Your own reasons, handed back one at a time. */
export function ReminderTicker({ reminders, interval = 5500, big = false }: { reminders: Reminder[]; interval?: number; big?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reminders.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % reminders.length), interval);
    return () => clearInterval(t);
  }, [reminders.length, interval]);
  if (reminders.length === 0) return null;
  const r = reminders[i % reminders.length];
  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={r.tone + i}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: TONE[r.tone] }}>
            {r.label}
          </p>
          <p className={`mt-1 leading-relaxed ${big ? "text-[16px] text-white/90" : "line-clamp-2 text-[13px] text-ink-2"}`}>
            “{r.text}”
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Upload, drop, paste, or a link. Calls back with a src. */
export function ImageAdder({ onAdd, compact = false }: { onAdd: (src: string) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { src } = await prepareImage(file);
      onAdd(src);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  const fromUrl = () => {
    const u = url.trim();
    if (!isUrl(u)) {
      setError("Paste a link starting with http:// or https://");
      return;
    }
    // Check it actually loads before keeping it.
    setBusy(true);
    setError(null);
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      setBusy(false);
      onAdd(u);
      setUrl("");
    };
    img.onerror = () => {
      setBusy(false);
      setError("That link didn't load as an image.");
    };
    img.src = u;
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void take(e.dataTransfer.files[0]);
      }}
      onPaste={(e) => {
        if (e.clipboardData.files[0]) void take(e.clipboardData.files[0]);
      }}
      className={compact ? "" : "rounded-xl border border-dashed border-line p-3"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden>
            <path d="M10 13V4M6.5 7.5 10 4l3.5 3.5M4 13.5V15a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 15v-1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {busy ? "Adding…" : "Upload"}
        </button>
        <span className="text-[11.5px] text-ink-3">or</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              fromUrl();
            }
          }}
          placeholder="Paste an image link…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12.5px] placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={fromUrl}
          disabled={url.trim() === "" || busy}
          className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11.5px] text-[var(--urgent)]">{error}</p>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void take(e.target.files?.[0])} />
    </div>
  );
}

/** Two thin bars: how much time is gone against how much is done. */
export function PaceBars({ time, done, verdict, hideTime = false }: { time: number; done: number | null; verdict: string | null; hideTime?: boolean }) {
  const color =
    verdict === "ahead" ? "var(--up)" : verdict === "on track" ? "var(--accent)" : verdict === "behind" ? "var(--high)" : "var(--urgent)";
  return (
    <div className="grid gap-1.5">
      <div className={`flex items-center gap-2 ${hideTime ? "hidden" : ""}`}>
        <span className="w-14 shrink-0 text-[10.5px] font-medium text-ink-3">Time</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
          <motion.div
            className="h-full rounded-full bg-[var(--text-3)]"
            initial={{ width: 0 }}
            animate={{ width: `${time * 100}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <span className="nums w-8 text-right text-[10.5px] text-ink-3">{Math.round(time * 100)}%</span>
      </div>
      {done != null && (
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10.5px] font-medium text-ink-3">Done</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${done * 100}%` }}
              transition={{ delay: 0.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="nums w-8 text-right text-[10.5px] font-semibold" style={{ color }}>
            {Math.round(done * 100)}%
          </span>
        </div>
      )}
      {verdict && (
        <p className="text-[11px] font-semibold" style={{ color }}>
          {verdict === "ahead"
            ? "Ahead of the clock — keep the lead."
            : verdict === "on track"
              ? "On pace with the clock."
              : verdict === "behind"
                ? "Behind the clock — the gap is still closable."
                : "Way behind the clock. Today matters."}
        </p>
      )}
    </div>
  );
}

export function Flame({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M10 17.5a5.5 5.5 0 0 0 5.5-5.5c0-3.3-2.2-5-3.3-7.7-1.1 2.2-2.2 2.8-3.3 4.4-.8-1.1-1.1-1.7-1.1-3.3C5.6 7 4.5 9.2 4.5 12a5.5 5.5 0 0 0 5.5 5.5z" fill="currentColor" />
    </svg>
  );
}

/** Compact "12d 04:33:10" countdown text. */
export function ClockText({ ms }: { ms: number }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className="nums tabular-nums">
      {d > 0 && <span className="font-bold">{d}d </span>}
      {hh}:{mm}:{ss}
    </span>
  );
}
