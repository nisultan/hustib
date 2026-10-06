"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { progressOf } from "@/lib/goals/tracker";
import { countdownLabel, daysUntil } from "@/lib/dates";
import { SectionTitle } from "./ui";

/**
 * What the week is actually for, on the page you open first.
 *
 * Goals lived one click away and were therefore invisible: a deadline you
 * cannot see is a deadline you are not working towards. Tracked goals make
 * this worth the space in a way a hand-set slider never did — the bars move on
 * their own as habits get ticked and tasks get finished, so this is a readout
 * rather than a reminder to go and update something.
 *
 * Only active goals, only four. The point is the two or three things actually
 * being worked on; a full list belongs on the goals page.
 */
const MAX = 4;

export function GoalsStrip() {
  const store = useStore();

  const goals = useMemo(
    () =>
      store.goals
        .filter((g) => g.status === "active")
        .sort((a, b) => {
          // Closest deadline first, then the ones with no date at all.
          const ad = a.deadline ? daysUntil(a.deadline) : 9999;
          const bd = b.deadline ? daysUntil(b.deadline) : 9999;
          return ad - bd || a.position - b.position;
        })
        .slice(0, MAX),
    [store.goals],
  );

  if (!store.ready || goals.length === 0) return null;

  return (
    <section>
      <SectionTitle
        right={
          <Link href="/goals" className="text-xs text-ink-3 hover:text-ink">
            All
          </Link>
        }
      >
        Goals
      </SectionTitle>

      <div className="grid gap-2">
        {goals.map((goal) => {
          const { value, tracked } = progressOf(goal, store);

          return (
            <Link
              key={goal.id}
              href="/goals"
              className="group flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-3 shadow-[var(--shadow),var(--edge)] transition-colors hover:border-line-strong"
            >
              {/* The picture, when there is one. It is most of why a goal feels
                  like a goal rather than a row in a table. */}
              {goal.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={goal.image}
                  alt=""
                  className="size-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-lg text-[15px]"
                  style={{
                    background: `color-mix(in srgb, var(--${goal.priority}) 14%, transparent)`,
                    color: `var(--${goal.priority})`,
                  }}
                >
                  ◎
                </span>
              )}

              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {goal.title}
                  </span>
                  {goal.deadline && (
                    <span className="nums shrink-0 text-[11px] text-ink-3">
                      {countdownLabel(goal.deadline)}
                    </span>
                  )}
                </span>

                {value != null ? (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                      <span
                        className="block h-full rounded-full bg-accent transition-[width] duration-700"
                        style={{ width: `${value}%` }}
                      />
                    </span>
                    <span className="nums shrink-0 text-[11px] text-ink-3">{value}%</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-3">No progress tracked</span>
                )}

                {/* What the bar counted. A number with no working shown is the
                    thing the hand-set slider already was. */}
                {tracked?.measured && (
                  <span className="nums truncate text-[10px] text-ink-3">
                    {tracked.source === "weight"
                      ? `${tracked.observed} kg → ${tracked.target} kg`
                      : `${tracked.observed} of ${tracked.target} ${tracked.unit} · ${tracked.window}`}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
