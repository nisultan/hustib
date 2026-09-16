"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Habit, WEEKDAY_LABEL } from "@/lib/types";
import { addDays, formatDate } from "@/lib/dates";
import { appliesOn, keptRate, streakOf } from "@/lib/habits";
import { Panel, SectionTitle } from "./ui";

/**
 * Habits, as a tracker rather than a list.
 *
 * The previous version showed today's habits as checkboxes and hid everything
 * else in Settings, which meant the one question a habit tracker exists to
 * answer — am I actually keeping this? — had no answer anywhere. Each row now
 * carries its last week as dots and its current run, so the state of a habit
 * is visible without opening anything.
 *
 * The dots are clickable. Forgetting to tick something until the next morning
 * is the normal case, and a tracker that only accepts today quietly punishes
 * people for the gap between doing a thing and recording it.
 */

/** Enough to see a rhythm, few enough to fit beside the day. */
const TRAIL = 7;

export function Habits({ date }: { date: string }) {
  const store = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const days = useMemo(() => new Map(store.days.map((d) => [d.date, d])), [store.days]);

  const live = store.habits.filter((h) => h.archivedAt == null);
  const dueToday = live.filter((h) => appliesOn(h, date));
  const doneToday = dueToday.filter(
    (h) => days.get(date)?.habitsDone.includes(h.id) ?? false,
  ).length;

  // Newest last, but anything due today first: the list is read top-down while
  // ticking, and a habit that does not apply today is reference, not a task.
  const ordered = [...live].sort(
    (a, b) => Number(appliesOn(b, date)) - Number(appliesOn(a, date)),
  );

  const trail = Array.from({ length: TRAIL }, (_, i) => addDays(date, -(TRAIL - 1 - i)));

  return (
    <section>
      <SectionTitle
        right={
          dueToday.length > 0 ? (
            <span className="nums text-xs text-ink-3">
              {doneToday}/{dueToday.length} today
            </span>
          ) : undefined
        }
      >
        Habits
      </SectionTitle>

      <Panel className="divide-y divide-[var(--border)]">
        {ordered.length === 0 && !adding && (
          <p className="px-3.5 py-5 text-center text-[13px] text-ink-3">
            Nothing tracked yet. A habit is something you want to do regularly — reading,
            training, a language.
          </p>
        )}

        {ordered.map((habit) =>
          editing === habit.id ? (
            <Editor key={habit.id} habit={habit} onDone={() => setEditing(null)} />
          ) : (
            <Row
              key={habit.id}
              habit={habit}
              date={date}
              trail={trail}
              days={days}
              onEdit={() => setEditing(habit.id)}
            />
          ),
        )}

        {adding ? (
          <Editor onDone={() => setAdding(false)} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left text-[13px] text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <span aria-hidden className="text-base leading-none">
              +
            </span>
            New habit
          </button>
        )}
      </Panel>

      <Archived />
    </section>
  );
}

function Row({
  habit,
  date,
  trail,
  days,
  onEdit,
}: {
  habit: Habit;
  date: string;
  trail: string[];
  days: Map<string, { habitsDone: string[] }>;
  onEdit: () => void;
}) {
  const store = useStore();
  const due = appliesOn(habit, date);
  const doneToday = days.get(date)?.habitsDone.includes(habit.id) ?? false;
  const streak = streakOf(habit, days as never, date);
  const { kept, due: total } = keptRate(habit, days as never, date);

  return (
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 ${due ? "" : "opacity-55"}`}>
      <button
        role="checkbox"
        aria-checked={doneToday}
        aria-label={habit.name}
        disabled={!due}
        onClick={() => store.toggleHabit(date, habit.id)}
        className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
          doneToday
            ? "border-accent bg-accent text-white"
            : due
              ? "border-line-strong hover:border-accent"
              : "border-line"
        }`}
      >
        {doneToday && (
          <svg viewBox="0 0 16 16" aria-hidden className="size-3">
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

      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-[13px] ${doneToday ? "text-ink-3" : ""}`}>
          {habit.name}
        </span>
        <span className="block text-[10px] text-ink-3">
          {due ? cadence(habit) : `${cadence(habit)} · not today`}
          {total > 0 && ` · ${Math.round((kept / total) * 100)}% of the last month`}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-[3px]" aria-hidden>
        {trail.map((day) => (
          <Dot key={day} habit={habit} date={day} days={days} />
        ))}
      </div>

      <span
        className={`nums w-8 shrink-0 text-right text-[11px] ${
          streak > 0 ? "text-accent-text" : "text-ink-3"
        }`}
        title={streak > 0 ? `${streak} in a row` : "No run yet"}
      >
        {streak > 0 ? `${streak}🔥` : "—"}
      </span>
    </div>
  );
}

/** One day in the trail. Filled if kept, hollow if missed, faint if not due. */
function Dot({
  habit,
  date,
  days,
}: {
  habit: Habit;
  date: string;
  days: Map<string, { habitsDone: string[] }>;
}) {
  const store = useStore();
  const due = appliesOn(habit, date);
  const done = days.get(date)?.habitsDone.includes(habit.id) ?? false;

  return (
    <button
      onClick={() => due && store.toggleHabit(date, habit.id)}
      disabled={!due}
      aria-hidden={false}
      aria-label={`${formatDate(date)}: ${done ? "kept" : due ? "missed" : "not due"}`}
      title={`${formatDate(date)} — ${done ? "kept" : due ? "missed" : "not due"}`}
      className={`size-[9px] rounded-full transition-colors ${
        done
          ? "bg-accent"
          : due
            ? "border border-line-strong hover:border-accent"
            : "bg-[var(--border)]"
      }`}
    />
  );
}

/**
 * Creating and changing a habit, in the row it belongs to.
 *
 * One form for both, because "add" and "edit" differ only in whether there is
 * something to start from, and two near-identical forms drift apart.
 */
function Editor({ habit, onDone }: { habit?: Habit; onDone: () => void }) {
  const store = useStore();
  const [name, setName] = useState(habit?.name ?? "");
  const [everyDay, setEveryDay] = useState((habit?.weekdays.length ?? 0) === 0);
  const [weekdays, setWeekdays] = useState<number[]>(habit?.weekdays ?? []);

  const save = () => {
    const clean = name.trim();
    if (clean === "") {
      onDone();
      return;
    }
    const days = everyDay ? [] : [...weekdays].sort();

    if (habit) store.updateHabit(habit.id, { name: clean, weekdays: days });
    else store.addHabit({ name: clean, categoryId: null, weekdays: days });
    onDone();
  };

  const toggle = (day: number) =>
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  return (
    <div className="flex flex-col gap-2.5 bg-panel-2 px-3.5 py-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onDone();
        }}
        placeholder="What do you want to do regularly?"
        className="w-full rounded-md border border-line-strong bg-bg px-2.5 py-1.5 text-[13px] outline-none"
      />

      {/* Spelled out rather than inferred from an empty selection: "no days
          chosen means every day" is a rule nobody guesses correctly. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5">
          {[
            { label: "Every day", value: true },
            { label: "Certain days", value: false },
          ].map((option) => (
            <button
              key={option.label}
              onClick={() => setEveryDay(option.value)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                everyDay === option.value
                  ? "bg-accent-soft text-accent-text"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {!everyDay && (
          <div className="flex items-center gap-0.5" role="group" aria-label="Days">
            {WEEKDAY_LABEL.map((label, day) => (
              <button
                key={day}
                onClick={() => toggle(day)}
                aria-pressed={weekdays.includes(day)}
                className={`grid size-6 place-items-center rounded text-[10px] font-medium transition-colors ${
                  weekdays.includes(day) ? "bg-accent text-white" : "text-ink-3 hover:bg-panel"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={name.trim() === ""}
          className="rounded-lg bg-accent px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
        >
          {habit ? "Save" : "Add habit"}
        </button>
        <button
          onClick={onDone}
          className="rounded-lg px-2 py-1 text-[12px] text-ink-3 transition-colors hover:text-ink"
        >
          Cancel
        </button>

        {habit && (
          <button
            onClick={() => {
              store.archiveHabit(habit.id);
              onDone();
            }}
            title="Keeps the history, stops tracking it"
            className="ml-auto text-[12px] text-ink-3 transition-colors hover:text-[var(--urgent)]"
          >
            Stop tracking
          </button>
        )}
      </div>
    </div>
  );
}

function Archived() {
  const store = useStore();
  const archived = store.habits.filter((h) => h.archivedAt != null);
  if (archived.length === 0) return null;

  return (
    <details className="mt-2">
      <summary className="cursor-pointer px-1 text-[11px] text-ink-3 hover:text-ink">
        {archived.length} stopped
      </summary>
      <div className="mt-1 flex flex-col gap-1 px-1">
        {archived.map((habit) => (
          <div key={habit.id} className="flex items-center gap-2 text-[11px] text-ink-3">
            <span className="flex-1 truncate line-through">{habit.name}</span>
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
  );
}

/** "Every day", or the days it actually runs. */
function cadence(habit: Habit): string {
  if (habit.weekdays.length === 0) return "Every day";
  if (habit.weekdays.length === 7) return "Every day";

  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdaysOnly = [1, 2, 3, 4, 5].every((d) => habit.weekdays.includes(d));
  if (weekdaysOnly && habit.weekdays.length === 5) return "Weekdays";

  return habit.weekdays.map((d) => names[d]).join(", ");
}
