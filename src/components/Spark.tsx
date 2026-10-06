"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { productivity } from "@/lib/productivity";
import { upcoming } from "@/lib/calendar";
import { appliesOn } from "@/lib/habits";
import { todayISO } from "@/lib/dates";

/**
 * Lifee's line for today.
 *
 * The one thing in the hub that runs without being asked, so it is kept to the
 * smallest call there is: a dozen numbers in, one sentence out, once per
 * calendar day. The insights pass reads a term of journal entries and is
 * therefore behind a button; this reads nothing it could not have got from the
 * dashboard itself.
 *
 * Cached in localStorage rather than in the store, deliberately. It is worth
 * nothing tomorrow, it does not need to reach another device, and putting it
 * in the database would mean a migration and a sync for a sentence with a
 * shelf life of one morning. Losing it costs one cheap call.
 *
 * Fails silently in every direction. No key, no network, a bad day at Google —
 * the line is simply absent, because a dashboard that opens with an error
 * where its encouragement should be is worse than one with neither.
 */

const KEY = "iblearner.spark";

interface Cached {
  date: string;
  text: string;
}

export function Spark() {
  const store = useStore();
  const today = todayISO();
  const [text, setText] = useState<string | null>(null);
  const asked = useRef(false);

  /*
    The store through a ref, so the effect does not depend on it.

    `store` is a fresh object on every render, so an effect listing it re-runs
    constantly — and the first version aborted its own request from the cleanup
    before the answer came back, every time. The effect now depends on the two
    things that genuinely decide whether to ask.
  */
  const latest = useRef(store);
  latest.current = store;

  useEffect(() => {
    if (!store.ready || asked.current) return;

    let cached: Cached | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) cached = JSON.parse(raw) as Cached;
    } catch {
      // Private windows and blocked storage both land here. Not a problem:
      // the line is re-fetched, which is what would have happened anyway.
    }

    if (cached?.date === today && cached.text) {
      setText(cached.text);
      return;
    }

    asked.current = true;
    const state = snapshot(latest.current, today);
    // Nothing recorded yet means nothing to say about today, and a line
    // written from an empty hub is the generic poster sentence this exists to
    // avoid.
    if (state == null) return;

    /*
      Not aborted on unmount. The call is already paid for by the time anyone
      navigates away, and letting it finish means the answer reaches the cache
      and tomorrow's first load is free. Only the state write is guarded.
    */
    let live = true;
    void (async () => {
      try {
        const response = await fetch("/api/ai/spark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!response.ok) return;
        const body = (await response.json()) as { text?: string };
        if (typeof body.text !== "string" || body.text.trim() === "") return;
        try {
          localStorage.setItem(KEY, JSON.stringify({ date: today, text: body.text }));
        } catch {
          // Shown once this session, then. Better than not showing it at all.
        }
        if (live) setText(body.text);
      } catch {
        // Offline, or refused. Silence is the right outcome.
      }
    })();

    return () => {
      live = false;
    };
  }, [store.ready, today]);

  if (!text) return null;

  return (
    <p
      className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-ink-2"
      style={{ animation: "fade-up 400ms ease-out both" }}
    >
      <span
        aria-hidden
        className="mt-[7px] h-px w-5 shrink-0 rounded-full"
        style={{ background: "var(--accent)" }}
      />
      <span className="min-w-0">{text}</span>
    </p>
  );
}

/**
 * The morning, in as few words as it can be put.
 *
 * Counts and dates only — no journal, no task titles beyond the nearest one.
 * Returns null when there is genuinely nothing to describe.
 */
function snapshot(store: ReturnType<typeof useStore>, today: string): string | null {
  const open = store.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => t.dueDate != null && t.dueDate < today).length;
  const dueToday = open.filter((t) => t.dueDate === today).length;

  const done = store.days.find((d) => d.date === today)?.habitsDone ?? [];
  const dueHabits = store.habits.filter(
    (h) => h.archivedAt == null && appliesOn(h, today),
  );
  const habitsLeft = dueHabits.filter((h) => !done.includes(h.id)).length;

  const next = upcoming(store, today, { limit: 1 })[0];
  const { score, streak } = productivity(store);

  if (open.length === 0 && dueHabits.length === 0 && next == null) return null;

  const lines = [
    `Day: ${today}`,
    `Streak: ${streak} day${streak === 1 ? "" : "s"}`,
    `Consistency score: ${score} out of 100`,
    `Habits due today: ${dueHabits.length}, still unticked: ${habitsLeft}`,
    `Open tasks: ${open.length}, overdue: ${overdue}, due today: ${dueToday}`,
    next
      ? `Next thing coming: ${next.label}, in ${next.daysLeft} day${next.daysLeft === 1 ? "" : "s"}`
      : "Nothing with a date coming up.",
  ];

  const plan = store.plan.filter((p) => p.date === today);
  if (plan.length > 0) {
    lines.push(`Planned blocks today: ${plan.length}, done: ${plan.filter((p) => p.done).length}`);
  }

  return lines.join("\n");
}
