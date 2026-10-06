"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { habitRows } from "@/lib/activity";
import { streakOf } from "@/lib/habits";
import { addDays, todayISO } from "@/lib/dates";
import { SectionTitle } from "./ui";
import { Flame } from "./Flame";

/**
 * The last fortnight of each habit, as a row of marks.
 *
 * The tick list says what is left today and the streak number says how long
 * the run is, and neither shows the thing that actually matters: where it
 * broke. A run of fourteen with a hole on Tuesday and a run of fourteen that
 * never faltered read identically as "14", and only one of them is a habit.
 *
 * Fourteen days because it fits a narrow column at a legible square size, and
 * because a fortnight is about as far back as anyone argues with.
 */
const DAYS = 14;

export function HabitStreaks() {
  const store = useStore();
  const today = todayISO();

  const rows = useMemo(() => {
    const from = addDays(today, -(DAYS - 1));
    const byDate = new Map(store.days.map((d) => [d.date, d]));
    return habitRows(store, from, today, today).map((row) => {
      const habit = store.habits.find((h) => h.id === row.id);
      return { ...row, streak: habit ? streakOf(habit, byDate, today) : 0 };
    });
  }, [store, today]);

  if (!store.ready || rows.length === 0) return null;

  return (
    <section>
      <SectionTitle
        right={
          <Link href="/plan" className="text-xs text-ink-3 hover:text-ink">
            Habits
          </Link>
        }
      >
        Last two weeks
      </SectionTitle>

      <div className="rounded-xl border border-line bg-panel px-3.5 py-3 shadow-[var(--shadow),var(--edge)]">
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
                {row.name}
              </span>

              <span aria-hidden className="flex shrink-0 gap-[3px]">
                {row.marks.map((mark, i) => (
                  <span
                    key={i}
                    className="size-[9px] rounded-[2px]"
                    style={{
                      background:
                        mark === "kept"
                          ? "var(--up)"
                          : mark === "missed"
                            ? "color-mix(in srgb, var(--urgent) 28%, transparent)"
                            : "var(--panel-2)",
                    }}
                  />
                ))}
              </span>

              {/* The run, where it is a run. Zero is not shown: a habit nobody
                  has started yet does not need a 0 beside it saying so. */}
              <span className="nums flex w-11 shrink-0 items-center justify-end gap-0.5 text-[11px] text-ink-3">
                {row.streak > 0 && (
                  <>
                    {row.streak}
                    <Flame streak={row.streak} />
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
