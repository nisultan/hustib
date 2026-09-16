"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Task, PRIORITY_LABEL, PRIORITY_RANK } from "@/lib/types";
import { useCourseMap, useStore } from "@/lib/store";
import { daysUntil, formatTime, relativeLabel } from "@/lib/dates";
import { PriorityDot, ConfirmDeleteButton } from "./ui";
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
  const overdue = !done && task.dueDate != null && daysUntil(task.dueDate) < 0;

  const due = task.dueDate ? relativeLabel(task.dueDate) : null;
  const dueSoon = !done && task.dueDate != null && daysUntil(task.dueDate) === 0;

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
        className="group flex items-start gap-3 border-b border-line px-3.5 py-3 last:border-b-0 hover:bg-panel-2"
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
          className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors ${
            done
              ? "border-accent bg-accent text-white"
              : "border-line-strong hover:border-accent"
          }`}
        >
          {/* The tick lands rather than appearing — the one moment in the app
              worth a little overshoot, because it is the moment something got
              finished. */}
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
              className={`truncate text-sm font-medium ${
                done ? "text-ink-3 line-through" : "text-ink"
              }`}
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
              <span
                className={`sm:hidden ${
                  overdue ? "font-medium text-[var(--urgent)]" : dueSoon ? "text-ink" : ""
                }`}
              >
                {(task.lesson || task.dueTime) && (
                  <span aria-hidden className="mr-1.5">
                    ·
                  </span>
                )}
                {due}
              </span>
            )}
            {!done && PRIORITY_RANK[task.priority] >= PRIORITY_RANK.high && (
              <span
                className="inline-flex shrink-0 items-center gap-1 font-medium"
                style={{ color: `var(--${task.priority})` }}
              >
                <PriorityDot priority={task.priority} />
                {PRIORITY_LABEL[task.priority]}
              </span>
            )}
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
            className={`mt-0.5 hidden shrink-0 text-xs sm:block ${
              overdue
                ? "font-medium text-[var(--urgent)]"
                : dueSoon
                  ? "font-medium text-ink"
                  : "text-ink-3"
            }`}
          >
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
      className="overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow)]"
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
