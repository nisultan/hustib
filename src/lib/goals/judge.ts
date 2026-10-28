"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Goal } from "@/lib/types";
import { addDays, todayISO } from "@/lib/dates";
import { brief } from "@/lib/ai/brief";

/**
 * Keeping the journal-read goals current, without paying for it every visit.
 *
 * A reading is good for a few days. Opening the goals page or the dashboard
 * re-reads only the goals whose reading has gone stale, all of them in one
 * call; a fresh one is never re-read unless asked. A goal created a minute ago
 * is read straight away rather than on the next visit.
 *
 * There is also a per-goal, per-day attempt marker on the device, so a
 * database that cannot store the reading yet (migration 010 not run) costs one
 * call a day per goal rather than one a visit — while a goal added later the
 * same day still gets its first reading.
 */

const STALE_DAYS = 3;
const JOURNAL_DAYS = 21;
const JOURNAL_BUDGET = 10_000;
const ATTEMPT_KEY = "iblearner.goalReadAttempt";

let inFlight = false;

function readsFromJournal(g: Goal): boolean {
  return g.status === "active" && g.tracker?.source === "reflection";
}

function stale(g: Goal, today: string): boolean {
  const at = g.tracker?.judged?.at;
  return at == null || at.slice(0, 10) <= addDays(today, -STALE_DAYS);
}

export function useGoalReadings() {
  const store = useStore();
  const latest = useRef(store);
  latest.current = store;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async (force: boolean) => {
    const s = latest.current;
    const today = todayISO();
    let goals = s.goals.filter(readsFromJournal).filter((g) => force || stale(g, today));
    if (goals.length === 0 || inFlight) return;

    if (!force) {
      try {
        const raw = JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? "null") as
          | { date: string; ids: string[] }
          | null;
        const tried = raw?.date === today ? new Set(raw.ids) : new Set<string>();
        goals = goals.filter((g) => !tried.has(g.id));
        if (goals.length === 0) return;
        localStorage.setItem(
          ATTEMPT_KEY,
          JSON.stringify({ date: today, ids: [...tried, ...goals.map((g) => g.id)] }),
        );
      } catch {
        // Storage blocked: the staleness check alone still limits it.
      }
    }

    inFlight = true;
    setBusy(true);
    setError(null);

    // Handles rather than ids, for the reason goal-link gives: short, and a
    // handle the model invents maps to nothing instead of to the wrong goal.
    const handles = new Map(goals.map((g, i) => [`G${i + 1}`, g]));
    const goalText = [...handles.entries()]
      .map(([h, g]) =>
        [
          `${h}: ${g.title}`,
          g.note.trim() ? `  Why it matters: ${g.note.trim()}` : "",
          g.deadline ? `  Deadline: ${g.deadline}` : "  No deadline.",
          `  Set on: ${g.createdAt.slice(0, 10)}`,
          `  Previous reading: ${g.tracker?.judged ? `${g.tracker.judged.value} — ${g.tracker.judged.why}` : "none yet"}`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n");

    try {
      const response = await fetch("/api/ai/goal-judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: goalText, journal: journal(s, today), brief: brief(s, today) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Could not read the journal.");
      }
      const { readings } = (await response.json()) as {
        readings: { handle?: unknown; value?: unknown; why?: unknown }[];
      };

      for (const r of readings) {
        const g = typeof r.handle === "string" ? handles.get(r.handle.trim().toUpperCase()) : undefined;
        const value = Number(r.value);
        if (!g || !g.tracker || !Number.isFinite(value)) continue;
        latest.current.updateGoal(g.id, {
          tracker: {
            ...g.tracker,
            judged: {
              value: Math.min(100, Math.max(0, Math.round(value))),
              why: typeof r.why === "string" ? r.why.trim().slice(0, 280) : "",
              at: today,
            },
          },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the journal.");
    } finally {
      inFlight = false;
      setBusy(false);
    }
  }, []);

  // Keyed on which goals need a reading, so a goal added on this page — or a
  // reading that lands — re-runs the check, and nothing else does.
  const pending = store.goals
    .filter(readsFromJournal)
    .filter((g) => stale(g, todayISO()))
    .map((g) => g.id)
    .join(",");

  useEffect(() => {
    if (store.ready && pending !== "") void read(false);
  }, [store.ready, pending, read]);

  const count = store.goals.filter(readsFromJournal).length;
  return { count, busy, error, refresh: () => read(true) };
}

/** The last few weeks of the journal, newest first, cut to a budget. */
function journal(s: ReturnType<typeof useStore>, today: string): string {
  const from = addDays(today, -JOURNAL_DAYS);
  const out: string[] = [];
  let used = 0;
  for (const d of [...s.days].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    if (d.date < from) break;
    const text = d.reflection
      .filter((b) => b.type !== "image" && b.text.trim() !== "")
      .map((b) => b.text.trim())
      .join("\n");
    if (text === "") continue;
    const entry = `## ${d.date}\n${text}`;
    if (used + entry.length > JOURNAL_BUDGET) break;
    out.push(entry);
    used += entry.length;
  }
  return out.join("\n\n");
}
