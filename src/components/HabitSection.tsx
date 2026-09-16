"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { WEEKDAY_LABEL } from "@/lib/types";
import { Button, Input, Panel } from "./ui";

/**
 * The things meant to happen regularly.
 *
 * Archived rather than deleted when someone stops: a habit they kept for three
 * months is part of their record, and removing the row would quietly rewrite
 * every consistency figure that depended on it.
 */
export function HabitSection() {
  const store = useStore();
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([]);

  const live = store.habits.filter((h) => h.archivedAt == null);
  const archived = store.habits.filter((h) => h.archivedAt != null);

  const add = () => {
    const clean = name.trim();
    if (clean === "") return;
    store.addHabit({ name: clean, categoryId: null, weekdays: [...days].sort() });
    setName("");
    setDays([]);
  };

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold tracking-tight">Habits</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
          Things you want to do regularly. They appear on the Plan page each day they apply, and
          how often you keep them feeds your consistency score.
        </p>
      </div>

      <Panel className="divide-y divide-[var(--border)]">
        {live.map((habit) => (
          <div key={habit.id} className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
            <input
              value={habit.name}
              onChange={(e) => store.updateHabit(habit.id, { name: e.target.value })}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none"
            />
            <Weekdays
              value={habit.weekdays}
              onChange={(weekdays) => store.updateHabit(habit.id, { weekdays })}
            />
            <button
              onClick={() => store.archiveHabit(habit.id)}
              className="shrink-0 text-xs text-ink-3 transition-colors hover:text-[var(--urgent)]"
            >
              Stop
            </button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Add a habit…"
            className="min-w-0 flex-1"
          />
          <Weekdays value={days} onChange={setDays} />
          <Button onClick={add} disabled={name.trim() === ""}>
            Add
          </Button>
        </div>
      </Panel>

      {archived.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink">
            {archived.length} stopped
          </summary>
          <div className="mt-2 grid gap-1">
            {archived.map((habit) => (
              <div key={habit.id} className="flex items-center gap-2 text-xs text-ink-3">
                <span className="flex-1 line-through">{habit.name}</span>
                <button
                  onClick={() => store.updateHabit(habit.id, { archivedAt: null })}
                  className="transition-colors hover:text-ink"
                >
                  Resume
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

/** Which days it applies to. Nothing selected means every day. */
function Weekdays({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());

  return (
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Days">
      {WEEKDAY_LABEL.map((label, day) => {
        const on = value.length === 0 || value.includes(day);
        return (
          <button
            key={day}
            onClick={() => toggle(day)}
            aria-pressed={value.includes(day)}
            title={value.length === 0 ? "Every day" : undefined}
            className={`grid size-6 place-items-center rounded text-[10px] font-medium transition-colors ${
              on ? "bg-accent-soft text-accent-text" : "text-ink-3 hover:bg-panel-2"
            } ${value.length === 0 ? "opacity-60" : ""}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
