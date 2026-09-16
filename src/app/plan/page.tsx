"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, daysUntil, formatDate, pastLabel, todayISO } from "@/lib/dates";
import { Habit, PlanItem } from "@/lib/types";
import { courseColor } from "@/lib/appearance";
import { Button, PageHeader, Panel, SectionTitle } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { HabitSection } from "@/components/HabitSection";
import { TimeField } from "@/components/TimeField";

/**
 * One day at a time, as a column of hours.
 *
 * Not a week grid. A week grid answers "what does my week look like", which
 * the dashboard already answers, and it cannot be read on a phone without
 * pinching. A single day answers "what am I doing now", which is the question
 * someone opens a planner to ask, and it leaves room for the thing a calendar
 * has no place for — the habits and the loose intentions that are not attached
 * to an hour.
 */

/** The window most people actually plan inside. */
const FIRST_HOUR = 6;
const LAST_HOUR = 23;

export default function PlanPage() {
  const store = useStore();
  const [date, setDate] = useState(() => todayISO());

  const today = todayISO();
  const weekday = new Date(`${date}T12:00:00`).getDay();

  const items = useMemo(
    () =>
      store.plan
        .filter((p) => p.date === date)
        .sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99")),
    [store.plan, date],
  );

  const scheduled = items.filter((p) => p.start != null);
  const loose = items.filter((p) => p.start == null);

  const habits = store.habits.filter(
    (h) =>
      h.archivedAt == null &&
      date >= h.createdAt &&
      (h.weekdays.length === 0 || h.weekdays.includes(weekday)),
  );
  const done = store.days.find((d) => d.date === date)?.habitsDone ?? [];

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const finished = items.filter((p) => p.done).length;

  return (
    <div className="page-in">
      <PageHeader
        title="Plan"
        subtitle="Your day, hour by hour. Block out the work, tick it as it goes."
      />

      <Panel className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-1">
          <Step label="Previous day" onClick={() => setDate(addDays(date, -1))} back />
          <div className="min-w-[150px] text-center">
            <p className="text-sm font-semibold tracking-tight">{formatDate(date)}</p>
            <p className="text-xs text-ink-3">{pastLabel(date)}</p>
          </div>
          <Step label="Next day" onClick={() => setDate(addDays(date, 1))} />
          {date !== today && (
            <Button size="sm" onClick={() => setDate(today)}>
              Today
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <p className="nums text-xs text-ink-3">
              {finished} of {items.length} done
            </p>
          )}
          <CarryOver date={date} />
          <div className="w-[190px]">
            <DateField value={date} onChange={(v) => setDate(v || today)} />
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle>The day</SectionTitle>
          <Panel className="overflow-hidden">
            {Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i).map(
              (hour) => (
                <Hour
                  key={hour}
                  hour={hour}
                  date={date}
                  today={today}
                  items={scheduled.filter((p) => Number((p.start ?? "").slice(0, 2)) === hour)}
                />
              ),
            )}
          </Panel>
        </section>

        <div className="flex flex-col gap-6">
          <Loose date={date} items={loose} />
          <Habits date={date} habits={habits} done={done} />

          <FromTasks date={date} />
        </div>
      </div>
    </div>
  );
}

/**
 * Yesterday's unfinished intentions, brought forward in one click.
 *
 * The alternative is retyping them, which is what makes people stop planning
 * after a week. Deliberately explicit rather than automatic: a plan that
 * silently refills itself with last week's failures is a guilt archive, and
 * choosing to carry something forward is the moment you decide it still
 * matters.
 */
function CarryOver({ date }: { date: string }) {
  const store = useStore();
  const yesterday = addDays(date, -1);

  const left = store.plan.filter((p) => p.date === yesterday && !p.done);
  if (left.length === 0) return null;

  return (
    <button
      onClick={() => {
        for (const item of left) store.updatePlanItem(item.id, { date });
      }}
      className="rounded-lg border border-line px-2 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:bg-panel-2 hover:text-ink"
    >
      Carry over {left.length}
    </button>
  );
}

/** One hour row, and the click target that adds a block inside it. */
function Hour({
  hour,
  date,
  today,
  items,
}: {
  hour: number;
  date: string;
  today: string;
  items: PlanItem[];
}) {
  const store = useStore();
  const now = new Date();
  const isNow = date === today && now.getHours() === hour;

  return (
    <div
      className={`flex items-stretch gap-3 border-b border-line last:border-0 ${
        isNow ? "bg-accent-soft/40" : ""
      }`}
    >
      <span className="nums w-14 shrink-0 py-2 pl-3.5 text-[11px] text-ink-3">
        {String(hour).padStart(2, "0")}:00
      </span>

      <div className="min-w-0 flex-1 py-1.5 pr-3">
        {items.length === 0 ? (
          <button
            onClick={() =>
              store.addPlanItem({
                date,
                title: "",
                start: `${String(hour).padStart(2, "0")}:00`,
                minutes: 60,
                done: false,
                categoryId: null,
                taskId: null,
              })
            }
            className="h-7 w-full rounded-md text-left text-xs text-transparent transition-colors hover:bg-panel-2 hover:text-ink-3"
          >
            + Add
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <Item key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** A single block: tick it, rename it, retime it, remove it. */
function Item({ item }: { item: PlanItem }) {
  const store = useStore();
  const category = store.categories.find((c) => c.id === item.categoryId);
  const task = item.taskId ? store.tasks.find((t) => t.id === item.taskId) : null;

  return (
    <div
      className="group flex items-center gap-2 rounded-md border border-line bg-panel-2 px-2 py-1.5"
      style={category ? { borderLeft: `2px solid ${courseColor(category.color)}` } : undefined}
    >
      <Tick checked={item.done} onChange={() => store.togglePlanItem(item.id)} />

      <input
        value={item.title}
        onChange={(e) => store.updatePlanItem(item.id, { title: e.target.value })}
        placeholder="What are you doing?"
        autoFocus={item.title === ""}
        className={`min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-ink-3 ${
          item.done ? "text-ink-3 line-through" : ""
        }`}
      />

      {task && (
        <span className="shrink-0 text-[10px] text-ink-3" title={`Linked to "${task.title}"`}>
          task
        </span>
      )}

      <div className="w-[104px] shrink-0">
        <TimeField
          value={item.start ?? ""}
          onChange={(v) => store.updatePlanItem(item.id, { start: v || null })}
        />
      </div>

      {/* Length matters for a plan that is meant to fit in a day, and typing
          a number is slower than picking from the handful anyone uses. */}
      <select
        value={item.minutes}
        onChange={(e) => store.updatePlanItem(item.id, { minutes: Number(e.target.value) })}
        aria-label="How long"
        className="shrink-0 cursor-pointer appearance-none bg-transparent text-[11px] text-ink-3 outline-none hover:text-ink"
      >
        {[15, 30, 45, 60, 90, 120, 180].map((m) => (
          <option key={m} value={m}>
            {m < 60 ? `${m}m` : `${m / 60}h`}
          </option>
        ))}
      </select>

      <button
        onClick={() => store.updatePlanItem(item.id, { date: addDays(item.date, 1) })}
        aria-label="Move to tomorrow"
        title="Move to tomorrow"
        className="grid size-5 shrink-0 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3">
          <path
            d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        onClick={() => store.deletePlanItem(item.id)}
        aria-label="Remove"
        className="grid size-5 shrink-0 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:text-[var(--urgent)] group-hover:opacity-100"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3">
          <path
            d="m4 4 8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Things meant for today that do not belong to an hour.
 *
 * Most intentions are like this, and a planner that insists on a time for
 * everything makes people either lie or give up.
 */
function Loose({ date, items }: { date: string; items: PlanItem[] }) {
  const store = useStore();
  const [draft, setDraft] = useState("");

  const add = () => {
    const title = draft.trim();
    if (title === "") return;
    store.addPlanItem({
      date,
      title,
      start: null,
      minutes: 30,
      done: false,
      categoryId: null,
      taskId: null,
    });
    setDraft("");
  };

  return (
    <section>
      <SectionTitle>Also today</SectionTitle>
      <Panel className="divide-y divide-[var(--border)]">
        {items.map((item) => (
          <div key={item.id} className="px-2 py-1.5">
            <Item item={item} />
          </div>
        ))}
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Add something for today…"
            className="flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          />
          <Button size="sm" onClick={add} disabled={draft.trim() === ""}>
            Add
          </Button>
        </div>
      </Panel>
    </section>
  );
}

/**
 * Pulling real work into the day.
 *
 * The tasks already carry deadlines and priorities, so the planner should not
 * ask the student to retype them — the point of planning is deciding when, not
 * writing the list out twice.
 */
function FromTasks({ date }: { date: string }) {
  const store = useStore();

  const planned = new Set(
    store.plan.filter((p) => p.date === date && p.taskId).map((p) => p.taskId),
  );

  const candidates = store.tasks
    .filter((t) => t.status !== "completed" && !planned.has(t.id))
    .sort((a, b) => {
      const ad = a.dueDate ? daysUntil(a.dueDate) : 999;
      const bd = b.dueDate ? daysUntil(b.dueDate) : 999;
      return ad - bd;
    })
    .slice(0, 6);

  if (candidates.length === 0) return null;

  return (
    <section>
      <SectionTitle>Pull in work</SectionTitle>
      <Panel className="divide-y divide-[var(--border)]">
        {candidates.map((task) => {
          const course = store.courses.find((c) => c.id === task.courseId);
          return (
            <button
              key={task.id}
              onClick={() =>
                store.addPlanItem({
                  date,
                  title: task.title,
                  start: null,
                  minutes: 45,
                  done: false,
                  categoryId: task.categoryId,
                  taskId: task.id,
                })
              }
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors hover:bg-panel-2"
            >
              <span className="min-w-0 flex-1 truncate text-[13px]">{task.title}</span>
              {course && <span className="shrink-0 text-[11px] text-ink-3">{course.code}</span>}
              <span className="shrink-0 text-[11px] text-ink-3">
                {task.dueDate ? relative(task.dueDate) : "—"}
              </span>
            </button>
          );
        })}
      </Panel>
    </section>
  );
}

/**
 * Today's habits, and the place to change what they are.
 *
 * They were in Settings, which is where you go once and then never again —
 * exactly wrong for the thing you tick every morning and revise every few
 * weeks. Editing lives behind a toggle so the daily view stays a checklist.
 */
function Habits({ date, habits, done }: { date: string; habits: Habit[]; done: string[] }) {
  const store = useStore();
  const [editing, setEditing] = useState(false);

  const kept = habits.filter((h) => done.includes(h.id)).length;

  return (
    <section>
      <SectionTitle
        right={
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            {editing ? "Done" : "Edit"}
          </button>
        }
      >
        Habits{habits.length > 0 && ` · ${kept}/${habits.length}`}
      </SectionTitle>

      {editing ? (
        <HabitSection />
      ) : habits.length === 0 ? (
        <Panel className="px-3.5 py-5 text-center">
          <p className="text-[13px] text-ink-2">No habits for today.</p>
          <button
            onClick={() => setEditing(true)}
            className="mt-1 text-xs text-accent-text hover:underline"
          >
            Add one
          </button>
        </Panel>
      ) : (
        <Panel className="divide-y divide-[var(--border)]">
          {habits.map((habit) => {
            const ticked = done.includes(habit.id);
            const category = store.categories.find((c) => c.id === habit.categoryId);
            return (
              <label
                key={habit.id}
                className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5"
              >
                <Tick checked={ticked} onChange={() => store.toggleHabit(date, habit.id)} />
                <span
                  className={`flex-1 text-[13px] ${ticked ? "text-ink-3 line-through" : ""}`}
                >
                  {habit.name}
                </span>
                {category && (
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: courseColor(category.color) }}
                  />
                )}
              </label>
            );
          })}
        </Panel>
      )}
    </section>
  );
}

function relative(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `${d}d`;
}

function Tick({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
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

function Step({
  label,
  onClick,
  back,
}: {
  label: string;
  onClick: () => void;
  back?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4">
        <path
          d={back ? "M10 3.5 L5.5 8 L10 12.5" : "M6 3.5 L10.5 8 L6 12.5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
