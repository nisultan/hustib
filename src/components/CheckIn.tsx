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
  const [replying, setReplying] = useState(false);
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
  const close = () => update({ status: answered ? "closed" : "dismissed" });

  /*
    A line, not a card. The first version was a full-width panel with an input
    always showing — the largest thing on the dashboard, for a question you
    answer in five seconds or not at all. Now it is one row: who is asking,
    what, and "Reply". The field opens when you take it up on it.
  */
  return (
    <section
      className="mb-6 rounded-xl border border-line bg-panel px-3 py-2.5"
      style={{ animation: "fade-up 360ms ease-out both" }}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-white">
          <LogoMark className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-[14px] leading-snug">
          <span className="font-semibold">Lifee</span>{" "}
          <span className="text-ink-2">{answered ? "— you answered:" : "asks:"}</span>{" "}
          <span className={answered ? "text-ink-3" : "text-ink"}>{day.question}</span>
        </p>
        {!answered && !replying && (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="shrink-0 rounded-[7px] bg-accent-soft px-3 py-1.5 text-[13px] font-medium text-accent-text transition-colors hover:brightness-95"
          >
            Reply
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label={answered ? "Close" : "Not now"}
          title={answered ? "Close" : "Not now"}
          className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
            <path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {!answered && replying && (
        <div className="mt-2.5 flex items-center gap-2 pl-10">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
              if (e.key === "Escape") setReplying(false);
            }}
            placeholder="Say it however — a word is fine"
            className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-[13.5px] placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={draft.trim() === ""}
            className="rounded-[7px] bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}

      {answered && (
        <div className="mt-2 grid gap-1.5 pl-10">
          {day.answer && <p className="text-[13px] text-ink-2">“{day.answer}”</p>}
          {waiting && !day.reply ? (
            <span className="flex gap-1 py-1" aria-label="Lifee is typing">
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className="size-1.5 rounded-full bg-ink-3"
                  style={{ animation: `pop 900ms ease-in-out ${k * 150}ms infinite alternate` }}
                />
              ))}
            </span>
          ) : (
            day.reply && (
              <p className="rounded-lg bg-accent-soft/60 px-3 py-2 text-[13.5px] leading-relaxed text-ink">
                {day.reply}
              </p>
            )
          )}
        </div>
      )}
    </section>
  );
}
