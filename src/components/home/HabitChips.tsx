"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { appliesOn, streakOf } from "@/lib/habits";
import { todayISO } from "@/lib/dates";
import { Flame } from "../Flame";

/**
 * Today's habits as a row of tap targets, the way Streaks and Habitify do it.
 *
 * A habit is a yes or a no, done in a second; it does not need a row in a
 * table with a heading over it. Each one is a pill with a circle — tap it, it
 * fills — and the run so far sits beside the name, so the reason to tick it
 * tonight is on the thing you tick.
 */
export function HabitChips() {
  const store = useStore();
  const today = todayISO();

  const habits = useMemo(
    () => store.habits.filter((h) => h.archivedAt == null && appliesOn(h, today)),
    [store.habits, today],
  );
  const byDate = useMemo(() => new Map(store.days.map((d) => [d.date, d])), [store.days]);
  const done = byDate.get(today)?.habitsDone ?? [];

  if (habits.length === 0) return null;
  const ticked = habits.filter((h) => done.includes(h.id)).length;

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-tight">
          Habits{" "}
          <span className="nums ml-1 text-[13px] font-medium text-ink-3">
            {ticked}/{habits.length}
          </span>
        </h2>
        <Link href="/plan" className="text-[12.5px] text-ink-3 hover:text-ink">
          Manage
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {habits.map((h) => {
          const on = done.includes(h.id);
          const run = streakOf(h, byDate, today);
          return (
            <button
              key={h.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => store.toggleHabit(today, h.id)}
              className={`group inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-[13.5px] transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] ${
                on
                  ? "border-transparent bg-accent-soft text-accent-text"
                  : "border-line bg-panel text-ink hover:border-line-strong"
              }`}
            >
              <span
                className={`grid size-[20px] shrink-0 place-items-center rounded-full border-[1.75px] transition-colors ${
                  on ? "border-accent bg-accent text-white" : "border-line-strong group-hover:border-accent"
                }`}
              >
                {on && (
                  <svg viewBox="0 0 12 12" aria-hidden className="size-2.5">
                    <path d="m2.5 6.2 2.3 2.3L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={on ? "line-through decoration-1 opacity-80" : ""}>{h.name}</span>
              {run > 0 && (
                <span className="nums inline-flex items-center gap-0.5 text-[12px] text-ink-3">
                  {run}
                  <Flame streak={run} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
