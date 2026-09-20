"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { appliesOn, streakOf } from "@/lib/habits";
import { formatTime, todayISO } from "@/lib/dates";
import { courseColor } from "@/lib/appearance";
import { SectionTitle } from "./ui";

/**
 * Today, as it will actually happen.
 *
 * The dashboard already said what was due and what was coming; neither answers
 * "what am I doing next", which is the thing someone checks a hub for between
 * lessons. The planner knows, and the habits know, and both were a page away.
 *
 * Everything here is tickable in place. A block you have to open another page
 * to tick does not get ticked, and an untickable list of your own plan is just
 * a reminder that you are behind it.
 */
export function TodayPanel() {
  const store = useStore();
  const today = todayISO();

  const blocks = useMemo(
    () =>
      store.plan
        .filter((p) => p.date === today)
        .sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99")),
    [store.plan, today],
  );

  const habits = useMemo(
    () => store.habits.filter((h) => h.archivedAt == null && appliesOn(h, today)),
    [store.habits, today],
  );

  const done = store.days.find((d) => d.date === today)?.habitsDone ?? [];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // The first thing today that has not finished yet. Highlighting what is
  // next is the whole reason to show a timetable rather than a list.
  const nextId = blocks.find(
    (b) => !b.done && (b.start == null || toMinutes(b.start) + b.minutes > nowMinutes),
  )?.id;

  if (blocks.length === 0 && habits.length === 0) return null;

  return (
    <section>
      <SectionTitle
        right={
          <Link href="/plan" className="text-xs text-ink-3 hover:text-ink">
            Plan
          </Link>
        }
      >
        Today&rsquo;s plan
      </SectionTitle>

      <div className="grid gap-3 sm:grid-cols-2">
        {blocks.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow),var(--edge)]">
            {blocks.map((block) => {
              const category = store.categories.find((c) => c.id === block.categoryId);
              const isNext = block.id === nextId;

              return (
                <div
                  key={block.id}
                  className={`flex items-center gap-2.5 border-b border-line px-3 py-2 last:border-b-0 ${
                    isNext ? "bg-accent-soft/40" : ""
                  }`}
                >
                  <Tick checked={block.done} onChange={() => store.togglePlanItem(block.id)} />

                  <span className="nums w-11 shrink-0 text-[11px] text-ink-3">
                    {block.start ? formatTime(block.start) : "—"}
                  </span>

                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      block.done ? "text-ink-3 line-through" : ""
                    }`}
                  >
                    {block.title || "Untitled"}
                  </span>

                  {category && (
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: courseColor(category.color) }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {habits.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow),var(--edge)]">
            {habits.map((habit) => {
              const ticked = done.includes(habit.id);
              const streak = streakOf(
                habit,
                new Map(store.days.map((d) => [d.date, d])),
                today,
              );

              return (
                <label
                  key={habit.id}
                  className="flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2 last:border-b-0"
                >
                  <Tick checked={ticked} onChange={() => store.toggleHabit(today, habit.id)} />

                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      ticked ? "text-ink-3 line-through" : ""
                    }`}
                  >
                    {habit.name}
                  </span>

                  {/* The run is the reason to tick it tonight rather than
                      tomorrow, so it belongs on the row you tick. */}
                  {streak > 0 && (
                    <span className="nums shrink-0 text-[11px] text-accent-text">
                      {streak}🔥
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Tick({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`grid size-4 shrink-0 place-items-center rounded border transition-colors ${
        checked
          ? "border-accent bg-accent text-white"
          : "border-line-strong hover:border-accent"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" aria-hidden className="size-2.5">
          <path
            d="m3.5 8.5 3 3 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function toMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
}
