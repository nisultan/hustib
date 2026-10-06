import { Task } from "../types";

/**
 * The two things a task row must never contradict.
 *
 * Both are check constraints in the schema — `due_time_needs_due_date` and
 * `completed_has_timestamp` — and both describe pairs of fields that are
 * meaningless apart: a deadline of "17:00" on no particular day, a task marked
 * done with no record of when.
 *
 * It lives in one place rather than at the call sites because a call site only
 * knows the field it is changing. "Clear" on an overdue task drops the date and
 * has no reason to think about a time it never touched, which is exactly how it
 * came to send the database a row Postgres refuses: the write failed, the screen
 * had already redrawn as though it had not, and the change disappeared on the
 * next reload.
 */
export function coherent<T extends Partial<Task>>(task: T): T {
  const fixed = { ...task };

  // A time with nothing to anchor it to is not a deadline.
  if (fixed.dueDate == null && fixed.dueTime != null) fixed.dueTime = null;

  // Only touched when the status is part of what is being written. A patch
  // that renames a task must not decide anything about whether it is finished.
  if (fixed.status !== undefined) {
    if (fixed.status === "completed") {
      fixed.completedAt ??= new Date().toISOString().slice(0, 10);
    } else {
      fixed.completedAt = null;
    }
  }

  return fixed;
}

/**
 * The patch to actually send, given the row it is being applied to.
 *
 * A patch cannot be checked on its own: `{ dueDate: null }` looks harmless
 * until you know the task already carries a time. So the merge happens first,
 * and the result is narrowed back down to the fields that changed — plus any
 * field the invariant had to correct, which the caller never asked about but
 * the database needs, or it keeps the half of the pair that is now wrong.
 */
export function patchFor(current: Task | undefined, patch: Partial<Task>): Partial<Task> {
  const merged = coherent(current ? { ...current, ...patch } : patch);

  const clean: Partial<Task> = {};
  for (const key of Object.keys(patch) as (keyof Task)[]) {
    (clean as Record<string, unknown>)[key] = merged[key];
  }
  if (merged.dueTime !== current?.dueTime) clean.dueTime = merged.dueTime ?? null;
  if (merged.completedAt !== current?.completedAt) clean.completedAt = merged.completedAt ?? null;

  return clean;
}
