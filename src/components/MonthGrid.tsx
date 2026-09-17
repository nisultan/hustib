"use client";

import { useStore } from "@/lib/store";
import { dayContents, monthMatrix, sameMonth, Layer, Mark } from "@/lib/calendar";
import { courseColor } from "@/lib/appearance";
import { IMPORTANT_KIND_GLYPH } from "@/lib/types";
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
  layers,
  onOpen,
  onAddDay,
  onEditDay,
}: {
  /** Any date in the month to show. */
  month: string;
  /** Which kinds of entry to draw. */
  layers: Layer[];
  onOpen: (date: string) => void;
  /** Adding an important day on a date, from the cell it belongs to. */
  onAddDay: (date: string) => void;
  onEditDay: (id: string) => void;
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
          const contents = dayContents(store, date, layers);
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
            /*
              A div rather than a button, because the cell now holds buttons of
              its own — an important day opens for editing where it sits, which
              is where anyone would click it. A button inside a button is not
              valid HTML, and browsers resolve it by dropping one of them.
            */
            <div
              key={date}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(date)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(date);
                }
              }}
              className={`group flex min-h-[104px] cursor-pointer flex-col gap-1 border-b border-r border-line p-1.5 text-left transition-colors hover:bg-panel-2 ${
                outside ? "opacity-40" : ""
              } ${weekend && !outside ? "bg-panel-2/40" : ""}`}
            >
              <div className="mb-0.5 flex items-center justify-between">
                <span
                  className={`nums grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-medium ${
                    isToday ? "bg-accent text-white" : "text-ink-2"
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </span>

                {/* Only on hover: a plus on all thirty-five days is
                    thirty-five pieces of furniture in a view whose whole job
                    is to be scannable. */}
                <button
                  type="button"
                  aria-label={`Add an important day on ${date}`}
                  title="Add an important day"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddDay(date);
                  }}
                  className="grid size-5 shrink-0 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:bg-panel hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                    <path
                      d="M8 3.5v9M3.5 8h9"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              {shown.map((entry) =>
                entry.mark ? (
                  <MarkChip key={entry.key} mark={entry.mark} onEditDay={onEditDay} />
                ) : (
                  <PlanChip key={entry.key} item={entry.plan!} />
                ),
              )}

              {hidden > 0 && (
                <span className="px-1 text-[10px] text-ink-3">+{hidden} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A deadline or an important day. Coloured by priority, because that is what makes a day heavy. */
function MarkChip({ mark, onEditDay }: { mark: Mark; onEditDay: (id: string) => void }) {
  const label = mark.year ? `${mark.label} (${ordinal(mark.year)})` : mark.label;

  const body = (
    <>
      <span aria-hidden className="shrink-0">
        {glyph(mark)}
      </span>
      <span className="truncate">{label}</span>
    </>
  );

  const className = `flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium ${
    mark.done ? "text-ink-3 line-through" : ""
  }`;
  const style = mark.done
    ? undefined
    : {
        color: `var(--${mark.priority})`,
        background: `color-mix(in srgb, var(--${mark.priority}) 12%, transparent)`,
      };

  // An important day is the one mark edited from the calendar, because the
  // calendar is the only place it lives. The others belong to a page of their
  // own, and opening the day is the right way in.
  if (mark.kind === "day") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEditDay(mark.id);
        }}
        className={`${className} hover:brightness-110`}
        style={style}
        title={`${label} — click to edit`}
      >
        {body}
      </button>
    );
  }

  return (
    <span className={className} style={style} title={label}>
      {body}
    </span>
  );
}

function glyph(mark: Mark): string {
  if (mark.kind === "day") return IMPORTANT_KIND_GLYPH[mark.dayKind ?? "other"];
  if (mark.kind === "university") return "◆";
  if (mark.kind === "goal") return "★";
  return "•";
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

/** "2nd", "18th" — which anniversary a yearly day has come round to. */
function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** 0 for Monday, matching the column order. */
function indexInWeek(iso: string): number {
  return (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
}
