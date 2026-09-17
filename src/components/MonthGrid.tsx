"use client";

import { useStore } from "@/lib/store";
import { dayContents, monthMatrix, sameMonth, Mark } from "@/lib/calendar";
import { courseColor } from "@/lib/appearance";
import { todayISO } from "@/lib/dates";

/**
 * The month, as the thing you scan before committing to a week.
 *
 * Deliberately not a grid of tiny calendars-within-calendars: each cell shows
 * what is actually on that day in the order it will happen, and everything
 * past the first few becomes a count. A month view that tries to show
 * everything shows nothing, and the question it answers is "which days are
 * heavy and which are free", not "what exactly am I doing on the 14th".
 *
 * Clicking a day opens it. That is the only way a month view is useful —
 * as a way in.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Beyond this a cell becomes unreadable, so the rest is a count. */
const MAX_VISIBLE = 3;

export function MonthGrid({
  month,
  onOpen,
}: {
  /** Any date in the month to show. */
  month: string;
  onOpen: (date: string) => void;
}) {
  const store = useStore();
  const weeks = monthMatrix(month);
  const today = todayISO();

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow),var(--edge)]">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-ink-3"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((date) => {
          const contents = dayContents(store, date);
          const outside = !sameMonth(date, month);
          const isToday = date === today;
          const weekend = indexInWeek(date) >= 5;

          const items = [
            ...contents.marks.map((m) => ({ key: `m-${m.id}`, mark: m as Mark, plan: null })),
            ...contents.plan.map((p) => ({ key: `p-${p.id}`, mark: null, plan: p })),
          ];
          const shown = items.slice(0, MAX_VISIBLE);
          const hidden = items.length - shown.length;

          return (
            <button
              key={date}
              onClick={() => onOpen(date)}
              className={`group flex min-h-[104px] flex-col gap-1 border-b border-r border-line p-1.5 text-left transition-colors last:border-r-0 hover:bg-panel-2 ${
                outside ? "opacity-40" : ""
              } ${weekend && !outside ? "bg-panel-2/40" : ""}`}
            >
              <span
                className={`nums mb-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-medium ${
                  isToday ? "bg-accent text-white" : "text-ink-2"
                }`}
              >
                {Number(date.slice(8, 10))}
              </span>

              {shown.map((entry) =>
                entry.mark ? (
                  <MarkChip key={entry.key} mark={entry.mark} />
                ) : (
                  <PlanChip key={entry.key} item={entry.plan!} />
                ),
              )}

              {hidden > 0 && (
                <span className="px-1 text-[10px] text-ink-3">+{hidden} more</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A deadline. Coloured by priority, because that is what makes a day heavy. */
function MarkChip({ mark }: { mark: Mark }) {
  return (
    <span
      className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium ${
        mark.done ? "text-ink-3 line-through" : ""
      }`}
      style={
        mark.done
          ? undefined
          : {
              color: `var(--${mark.priority})`,
              background: `color-mix(in srgb, var(--${mark.priority}) 12%, transparent)`,
            }
      }
      title={mark.label}
    >
      <span aria-hidden className="shrink-0">
        {mark.kind === "university" ? "◆" : mark.kind === "goal" ? "★" : "•"}
      </span>
      <span className="truncate">{mark.label}</span>
    </span>
  );
}

/** Something planned. Quieter than a deadline: it is a choice, not a limit. */
function PlanChip({ item }: { item: { title: string; categoryId: string | null; done: boolean } }) {
  const store = useStore();
  const category = store.categories.find((c) => c.id === item.categoryId);

  return (
    <span
      className={`flex items-center gap-1 truncate rounded bg-panel-2 px-1 py-0.5 text-[10px] ${
        item.done ? "text-ink-3 line-through" : "text-ink-2"
      }`}
      title={item.title}
    >
      <span
        aria-hidden
        className="size-1 shrink-0 rounded-full"
        style={{ background: category ? courseColor(category.color) : "var(--text-3)" }}
      />
      <span className="truncate">{item.title || "Untitled"}</span>
    </span>
  );
}

/** 0 for Monday, matching the column order. */
function indexInWeek(iso: string): number {
  return (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
}
