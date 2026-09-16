import { Day, Habit } from "./types";
import { addDays } from "./dates";

/**
 * The rules a habit follows, in one place.
 *
 * Both the tracker and the consistency score need to answer "was this due on
 * that day" and "how long is the run", and two copies of that arithmetic drift
 * the moment one of them learns about archiving or weekday rules.
 */

/** Whether the habit was expected on a date, given its weekdays and its age. */
export function appliesOn(habit: Habit, date: string): boolean {
  if (date < habit.createdAt) return false;
  if (habit.archivedAt != null && date > habit.archivedAt) return false;
  if (habit.weekdays.length === 0) return true;
  return habit.weekdays.includes(weekdayOf(date));
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

/**
 * How many days in a row it has been kept, counting back from today.
 *
 * Days the habit was not due are skipped rather than breaking the run: a
 * Monday/Wednesday/Friday habit is not broken by a Tuesday, and a tracker that
 * says otherwise is punishing someone for their own schedule.
 *
 * Today counts only if already done — a day still being lived should not end
 * a streak that is about to continue.
 */
export function streakOf(habit: Habit, days: Map<string, Day>, today: string): number {
  let run = 0;
  let date = today;

  for (let guard = 0; guard < 400; guard += 1) {
    if (date < habit.createdAt) break;

    if (appliesOn(habit, date)) {
      const done = days.get(date)?.habitsDone.includes(habit.id) ?? false;
      if (done) {
        run += 1;
      } else if (date !== today) {
        break;
      }
      // An unticked today is simply not counted yet.
    }
    date = addDays(date, -1);
  }

  return run;
}

/** How often it was kept, across the days it was actually due. */
export function keptRate(
  habit: Habit,
  days: Map<string, Day>,
  today: string,
  window = 30,
): { kept: number; due: number } {
  let kept = 0;
  let due = 0;

  for (let i = 0; i < window; i += 1) {
    const date = addDays(today, -i);
    if (!appliesOn(habit, date)) continue;
    due += 1;
    if (days.get(date)?.habitsDone.includes(habit.id)) kept += 1;
  }

  return { kept, due };
}
