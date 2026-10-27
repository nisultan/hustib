"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Block } from "@/lib/types";
import { todayISO } from "@/lib/dates";
import { pickCheckIn, shouldAsk } from "@/lib/checkin";
import { brief } from "@/lib/ai/brief";
import { LogoMark } from "./Logo";

/**
 * Lifee, asking.
 *
 * Every other surface in the hub waits to be used. This is the one that turns
 * round and asks — "how are you", or, on a day with a reason, the specific
 * thing a friend would have noticed. It shows sometimes rather than daily: a
 * question that appears every morning becomes a box to close.
 *
 * The answer goes into today's journal, question and all, so it is not a
 * throwaway: the assistant and the weekly reading both see it later, and a
 * month of "tired, exams" next to the habits that slipped that month is
 * exactly the connection the hub exists to make.
 *
 * State is kept in localStorage rather than the store. It is a per-device
 * nicety — which question was shown, whether it was waved away — and the part
 * that matters, the answer, has already gone to the journal where it syncs.
 */

const KEY = "iblearner.checkin";

interface Day {
  date: string;
  key: string;
  question: string;
  status: "open" | "dismissed" | "answered" | "closed";
  answer?: string;
  reply?: string;
}

interface Stored {
  lastAnswered: string | null;
  day: Day | null;
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    // Blocked storage: ask anyway, forget tomorrow. Harmless.
  }
  return { lastAnswered: null, day: null };
}

function save(next: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // As above.
  }
}

function blockId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CheckIn() {
  const store = useStore();
  const today = todayISO();
  const [day, setDay] = useState<Day | null>(null);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const decided = useRef(false);

  // The store through a ref: it is a new object every render, and the
  // decision about whether to ask should be made once, not on every tick.
  const latest = useRef(store);
  latest.current = store;

  useEffect(() => {
    if (!store.ready || decided.current) return;
    decided.current = true;

    const stored = load();
    if (stored.day?.date === today) {
      setDay(stored.day);
      return;
    }

    const pick = pickCheckIn(latest.current, today);
    if (!shouldAsk(pick, today, stored.lastAnswered)) return;

    const fresh: Day = { date: today, key: pick.key, question: pick.question, status: "open" };
    save({ ...stored, day: fresh });
    setDay(fresh);
  }, [store.ready, today]);

  if (day == null || day.status === "dismissed" || day.status === "closed") return null;

  const update = (patch: Partial<Day>, lastAnswered?: string) => {
    const next = { ...day, ...patch };
    const stored = load();
    save({ lastAnswered: lastAnswered ?? stored.lastAnswered, day: next });
    setDay(next);
  };

  const send = async () => {
    const answer = draft.trim();
    if (answer === "" || waiting) return;

    // Into the journal first, so the answer is kept whatever happens to the
    // reply. A quote block for the question reads like what it was: something
    // asked, with their words underneath.
    const s = latest.current;
    const existing = s.days.find((d) => d.date === today)?.reflection ?? [];
    const blocks: Block[] = [
      ...existing,
      { id: blockId(), type: "quote", text: day.question, done: false },
      { id: blockId(), type: "text", text: answer, done: false },
    ];
    s.setDay(today, { reflection: blocks });

    update({ status: "answered", answer }, today);
    setDraft("");
    setWaiting(true);

    try {
      const response = await fetch("/api/ai/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: day.question, answer, brief: brief(s, today) }),
      });
      if (response.ok) {
        const body = (await response.json()) as { text?: string };
        if (typeof body.text === "string" && body.text.trim() !== "") {
          update({ status: "answered", answer, reply: body.text }, today);
        }
      }
    } catch {
      // No reply is fine — the answer is already in the journal, and the card
      // says so. A check-in that errors at someone who just said they're
      // tired would be the worst possible outcome here.
    } finally {
      setWaiting(false);
    }
  };

  const answered = day.status === "answered";

  return (
    <section
      className="relative mb-8 overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-[var(--shadow),var(--edge)]"
      style={{ animation: "fade-up 420ms ease-out both" }}
    >
      {/* A wash from the corner Lifee speaks from, so the card reads as a
          voice rather than as another panel of data. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(420px 160px at 0% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%)",
        }}
      />

      <button
        type="button"
        onClick={() => update({ status: answered ? "closed" : "dismissed" })}
        aria-label={answered ? "Close" : "Not now"}
        title={answered ? "Close" : "Not now"}
        className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
          <path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <div className="relative grid gap-3">
        {/* Lifee's line */}
        <div className="flex items-start gap-2.5 pr-8">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-white">
            <LogoMark className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Lifee</p>
            <p className="mt-0.5 text-[15px] font-medium leading-snug">{day.question}</p>
          </div>
        </div>

        {answered && day.answer && (
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-accent px-3.5 py-2 text-[13.5px] leading-relaxed text-white">
              {day.answer}
            </p>
          </div>
        )}

        {answered && (waiting || day.reply) && (
          <div className="flex items-start gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
              <LogoMark className="size-4" />
            </span>
            {waiting && !day.reply ? (
              <span className="mt-2 flex gap-1" aria-label="Lifee is typing">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-ink-3"
                    style={{ animation: `pop 900ms ease-in-out ${i * 150}ms infinite alternate` }}
                  />
                ))}
              </span>
            ) : (
              <p className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md bg-panel-2 px-3.5 py-2 text-[13.5px] leading-relaxed text-ink">
                {day.reply}
              </p>
            )}
          </div>
        )}

        {!answered && (
          <div className="flex items-center gap-2 pl-[38px]">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              placeholder="Say it however — a word is fine"
              className="min-w-0 flex-1 rounded-xl border border-line bg-panel-2 px-3 py-2 text-[13.5px] placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={draft.trim() === ""}
              className="rounded-xl bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        )}

        <p className="pl-[38px] text-[10.5px] text-ink-3">
          {answered
            ? "Saved to today's journal."
            : "Goes into today's journal, so Lifee remembers it."}
        </p>
      </div>
    </section>
  );
}
