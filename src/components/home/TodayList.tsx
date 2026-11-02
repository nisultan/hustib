"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatTime, todayISO } from "@/lib/dates";
import { courseColor } from "@/lib/appearance";
import { TaskList, sortTasks } from "../TaskItem";
import { TaskDialog } from "../TaskDialog";
import { EmptyState } from "../ui";

/**
 * Today, as one list — the way Things and Todoist open.
 *
 * The old dashboard spread today across five blocks: an overdue card,
 * countdown cards, a plan panel, a habits panel and a "due today" list, each
 * with its own heading and frame. Everything you can act on today now lives in
 * one column you read top to bottom: what is already late, what is due, what
 * is scheduled and when, and a line to add the next thing. The rest of the
 * page is context; this is the work.
 */
export function TodayList() {
  const store = useStore();
  const today = todayISO();
  const [adding, setAdding] = useState(false);

  const open = useMemo(() => store.tasks.filter((t) => t.status !== "completed"), [store.tasks]);
  const overdue = useMemo(
    () => open.filter((t) => t.dueDate != null && t.dueDate < today),
    [open, today],
  );
  const due = useMemo(() => sortTasks(open.filter((t) => t.dueDate === today)), [open, today]);
  const blocks = useMemo(
    () =>
      store.plan
        .filter((p) => p.date === today)
        .sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99")),
    [store.plan, today],
  );

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // The first block not yet finished, highlighted — the whole reason to show
  // a schedule rather than a list is to answer "what now".
  const nextId = blocks.find(
    (b) => !b.done && (b.start == null || toMinutes(b.start) + b.minutes > nowMin),
  )?.id;

  const nothing = overdue.length === 0 && due.length === 0 && blocks.length === 0;

  return (
    <section>
      {nothing ? (
        <EmptyState
          title="A clear day"
          hint="Nothing due and nothing scheduled. Add something, or enjoy it."
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-[7px] bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:brightness-[0.93]"
            >
              + Add task
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {overdue.length > 0 && (
            <div>
              <Header
                title="Overdue"
                count={overdue.length}
                tone="var(--urgent)"
                right={
                  // Todoist's one-click answer to a late pile: move it all to
                  // today, then decide row by row. Faster than five "Today"
                  // buttons, and the decision it forces is the right one.
                  <button
                    type="button"
                    onClick={() => overdue.forEach((t) => store.updateTask(t.id, { dueDate: today }))}
                    className="text-[12.5px] font-medium text-accent-text hover:underline"
                  >
                    Move all to today
                  </button>
                }
              />
              <TaskList tasks={overdue} />
            </div>
          )}

          {due.length > 0 && (
            <div>
              <Header title="Due today" count={due.length} />
              <TaskList tasks={due} />
            </div>
          )}

          {blocks.length > 0 && (
            <div>
              <Header
                title="Schedule"
                count={blocks.length}
                right={<span className="text-[12px] text-ink-3">{blocks.filter((b) => b.done).length} done</span>}
              />
              <ul className="border-t border-line">
                {blocks.map((b) => {
                  const category = store.categories.find((c) => c.id === b.categoryId);
                  const next = b.id === nextId;
                  return (
                    <li
                      key={b.id}
                      className={`flex items-center gap-3 border-b border-line py-2.5 ${next ? "-mx-2 rounded-lg border-transparent bg-accent-soft/50 px-2" : ""}`}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={b.done}
                        aria-label={`${b.title} done`}
                        onClick={() => store.togglePlanItem(b.id)}
                        className={`grid size-[19px] shrink-0 place-items-center rounded-full border-[1.75px] transition-colors ${
                          b.done ? "border-accent bg-accent text-white" : "border-line-strong hover:border-accent"
                        }`}
                      >
                        {b.done && (
                          <svg viewBox="0 0 12 12" aria-hidden className="size-2.5">
                            <path d="m2.5 6.2 2.3 2.3L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span
                        className={`nums w-[68px] shrink-0 text-[12.5px] ${next ? "font-semibold text-accent-text" : "text-ink-3"}`}
                      >
                        {b.start ? formatTime(b.start) : "Any time"}
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-[14px] ${b.done ? "text-ink-3 line-through" : ""}`}>
                        {b.title || "Untitled"}
                      </span>
                      {next && <span className="shrink-0 text-[11.5px] font-medium text-accent-text">Up next</span>}
                      {category && (
                        <span className="hidden shrink-0 items-center gap-1 text-[12px] text-ink-3 sm:inline-flex">
                          <span style={{ color: courseColor(category.color) }}>#</span>
                          {category.name}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* The inline add, exactly where the list ends. A button in a
              toolbar is a detour; a line at the bottom of the list is where
              your eye already is when you think of the next thing. */}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="group -mt-3 flex items-center gap-3 py-2 text-[14px] text-ink-3 transition-colors hover:text-accent-text"
          >
            <span className="grid size-[19px] place-items-center rounded-full text-accent transition-colors group-hover:bg-accent group-hover:text-white">
              <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            Add task
          </button>
        </div>
      )}

      <TaskDialog open={adding} onClose={() => setAdding(false)} defaultDueDate={today} />
    </section>
  );
}

function Header({
  title,
  count,
  tone,
  right,
}: {
  title: string;
  count: number;
  tone?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-bold tracking-tight" style={tone ? { color: tone } : undefined}>
        {title} <span className="nums ml-1 text-[13px] font-medium text-ink-3">{count}</span>
      </h2>
      {right}
    </div>
  );
}

function toMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
}
