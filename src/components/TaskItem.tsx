"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Task, PRIORITY_RANK } from "@/lib/types";
import { useCourseMap, useStore } from "@/lib/store";
import { daysUntil, formatTime, relativeLabel } from "@/lib/dates";
import { ConfirmDeleteButton } from "./ui";
import { courseColor } from "@/lib/appearance";
import { TaskDialog } from "./TaskDialog";
import { listContainer, listItem, spring } from "@/lib/motion";
import { play } from "@/lib/sound";

/** Sort: overdue first, then soonest deadline, then priority, then title. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    if (ad !== bd) return ad.localeCompare(bd);
    const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (p !== 0) return p;
    return a.title.localeCompare(b.title);
  });
}

export function TaskItem({ task, showCourse = true }: { task: Task; showCourse?: boolean }) {
  const store = useStore();
  const courses = useCourseMap();
  const [editing, setEditing] = useState(false);

  const done = task.status === "completed";
  const course = task.courseId ? courses.get(task.courseId) : null;
  const category = store.categories.find((c) => c.id === task.categoryId) ?? null;

  const due = task.dueDate ? relativeLabel(task.dueDate) : null;

  /*
    The date says how close it is by its colour, the way a planner would mark
    it: red when it has gone, green for today, orange for tomorrow, violet for
    later this week, and quiet grey beyond. You read urgency down a list before
    you read a single date.
  */
  const n = task.dueDate != null ? daysUntil(task.dueDate) : null;
  const dueColour =
    done || n == null
      ? "var(--text-3)"
      : n < 0
        ? "var(--urgent)"
        : n === 0
          ? "var(--up)"
          : n === 1
            ? "var(--high)"
            : n < 7
              ? "#8b5cf6"
              : "var(--text-3)";

  /*
    The checkbox ring carries the priority — the one convention every task app
    has converged on, because it puts the most important signal exactly where
    your eye lands to tick the thing off. Low priority is a plain grey ring.
  */
  const ring =
    task.priority === "urgent"
      ? "var(--urgent)"
      : task.priority === "high"
        ? "var(--high)"
        : task.priority === "medium"
          ? "var(--medium)"
          : "var(--border-strong)";

  return (
    <>
      {/*
        `layout` is what makes completing a task legible: the row does not
        just vanish and leave the list to snap shut — every row below it
        travels up to the space it left. The exit animation buys the eye the
        moment it needs to see which row went.
      */}
      <motion.div
        layout="position"
        variants={listItem}
        initial="hidden"
        animate="show"
        exit="exit"
        transition={spring}
        className="group flex items-start gap-3 border-b border-line py-2.5 pr-1 last:border-b-0"
      >
        <button
          onClick={() => {
            // The sound belongs to the act, not the state: ticking something
            // off is the moment worth marking, un-ticking it is a correction.
            if (!done) void play("complete");
            store.toggleTask(task.id);
          }}
          aria-label={
            done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`
          }
          style={{
            borderColor: ring,
            background: done ? ring : `color-mix(in srgb, ${ring} 9%, transparent)`,
            color: done ? "#fff" : ring,
          }}
          className="mt-px grid size-[19px] shrink-0 place-items-center rounded-full border-[1.75px] transition-[background-color,transform] duration-150 active:scale-90"
        >
          {/* The tick lands rather than appearing — the one moment in the app
              worth a little overshoot, because it is the moment something got
              finished. */}
          {!done && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
              className="opacity-0 transition-opacity group-hover:opacity-60"
            >
              <path
                d="m2.5 6.2 2.3 2.3L9.5 3.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {done && (
            <motion.svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 700, damping: 18 }}
            >
              <path
                d="m2.5 6.2 2.3 2.3L9.5 3.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          )}
        </button>

        <button
          onClick={() => setEditing(true)}
          className="min-w-0 flex-1 text-left"
          aria-label={`Edit ${task.title}`}
        >
          <span className="flex items-baseline gap-2">
            <span
              className={`truncate text-[14px] ${done ? "text-ink-3 line-through" : "text-ink"}`}
            >
              {task.title}
            </span>
            {task.status === "in_progress" && (
              <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-text">
                In progress
              </span>
            )}
          </span>

          {/*
            One coloured thing per row, and it means the course. The old row
            put a priority dot beside the title and a course dot beside the
            metadata, so two unexplained colours competed and neither read as
            anything. Priority now shows only when it is high enough to act
            on — a row labelled "Medium" was spending a word to say "normal".
          */}
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-3">
            {showCourse && course && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded bg-panel-2 px-1.5 py-0.5 font-medium text-ink-2">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: courseColor(course.color) }}
                />
                {course.name}
              </span>
            )}
            {category && (
              <span
                className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-medium"
                style={{
                  color: courseColor(category.color),
                  background: `color-mix(in srgb, ${courseColor(category.color)} 12%, transparent)`,
                }}
              >
                {category.name}
              </span>
            )}
            {task.lesson && <span className="truncate">{task.lesson}</span>}
            {task.dueTime && (
              <>
                {task.lesson && <span aria-hidden>·</span>}
                <span className="nums">{formatTime(task.dueTime)}</span>
              </>
            )}
            {/* The right-hand column is hidden on a phone, so the deadline
                rejoins the run there rather than vanishing. */}
            {due && (
              <span className="sm:hidden" style={{ color: dueColour }}>
                {(task.lesson || task.dueTime) && (
                  <span aria-hidden className="mr-1.5">
                    ·
                  </span>
                )}
                {due}
              </span>
            )}
            {/* No priority label: the checkbox ring already says it, in the
                place your eye lands to tick the task off. */}
          </span>

          {task.notes.length > 0 && (
            <span className="mt-1 block truncate text-xs text-ink-3">{task.notes}</span>
          )}
        </button>

        {/*
          The deadline gets its own column on the right. It is the one field
          you scan a list for, and inline in a dot-separated run it was the
          hardest thing on the row to find.
        */}
        {due && (
          <span
            className="mt-0.5 hidden shrink-0 items-center gap-1 text-[12px] sm:inline-flex"
            style={{ color: dueColour }}
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
              <rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {due}
          </span>
        )}

        {/* Revealed on hover on a pointer device, and always present for
            keyboard and touch users, who have no hover to reveal it. */}
        <ConfirmDeleteButton
          label={`Delete "${task.title}"`}
          onConfirm={() => store.deleteTask(task.id)}
          className="opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
        />
      </motion.div>

      <TaskDialog open={editing} onClose={() => setEditing(false)} task={task} />
    </>
  );
}

export function TaskList({
  tasks,
  showCourse = true,
  empty,
}: {
  tasks: Task[];
  showCourse?: boolean;
  empty?: React.ReactNode;
}) {
  if (tasks.length === 0) return <>{empty}</>;
  return (
    <motion.div
      variants={listContainer}
      initial="hidden"
      animate="show"
      // Lines between rows and nothing around them — a list on the page, not a
      // card on top of it.
      className="border-t border-line"
    >
      {/* `initial={false}` on the presence: rows already on screen when the
          page mounts are dealt in by the container's stagger, not replayed
          from scratch every time the list re-renders. */}
      <AnimatePresence initial={false}>
        {sortTasks(tasks).map((t) => (
          <TaskItem key={t.id} task={t} showCourse={showCourse} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
