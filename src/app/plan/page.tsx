"use client";

import { ReactNode, Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { addDays, daysUntil, formatDate, pastLabel, todayISO } from "@/lib/dates";
import { Habit, PlanItem, Priority, PRIORITIES, PRIORITY_LABEL } from "@/lib/types";
import { courseColor } from "@/lib/appearance";
import { Button, PageHeader, Panel, PriorityDot, SectionTitle } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { Popover } from "@/components/Popover";
import { Habits } from "@/components/Habits";
import { TimeRange } from "@/components/TimeRange";
import { TimeField } from "@/components/TimeField";
import { PlanItemMenu } from "@/components/PlanItemMenu";
import { DayGrid, toClock } from "@/components/DayGrid";
import { MonthGrid } from "@/components/MonthGrid";
import { ImportantDayDialog } from "@/components/ImportantDayDialog";
import {
  weekOf,
  monthLabel,
  addMonths,
  startOfWeek,
  dayContents,
  Layer,
  LAYERS,
  ALL_LAYERS,
  Mark,
} from "@/lib/calendar";

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

/**
 * What a drag is carrying.
 *
 * Two kinds, because two things can be dropped onto an hour: a block already
 * in the day, which moves, and a task from the list beside it, which becomes a
 * new block. Encoding both in one string keeps every drop target to a single
 * handler rather than one per source.
 */
const DRAG_TYPE = "application/x-lifeos-plan";

/** Where the day/sidebar split is remembered. */
const SPLIT_KEY = "iblearner.planSplit";

type View = "day" | "week" | "month";

/** Which zoom the student left it on. */
const VIEW_KEY = "iblearner.planView";

/** Which layers the calendar is drawing. */
const LAYERS_KEY = "iblearner.planLayers";

function dragPayload(kind: "plan" | "task", id: string): string {
  return `${kind}:${id}`;
}

function readDrag(e: React.DragEvent): { kind: string; id: string } | null {
  const raw = e.dataTransfer.getData(DRAG_TYPE);
  const at = raw.indexOf(":");
  return at === -1 ? null : { kind: raw.slice(0, at), id: raw.slice(at + 1) };
}

/**
 * Suspense is not decoration here: `useSearchParams` reads something that only
 * exists per request, so Next refuses to prerender a page using it unless the
 * part that reads it sits behind a boundary.
 */
export default function PlanPage() {
  return (
    <Suspense fallback={<div className="h-64" aria-busy="true" />}>
      <PlanView />
    </Suspense>
  );
}

function PlanView() {
  const store = useStore();
  /*
    Opened on a particular day when something sent us to one — the Progress
    heatmap links a square here, and landing on today instead of the day that
    was clicked makes the square look broken.

    Only the initial value. After that the date belongs to this page, so paging
    to next week must not be undone by a stale parameter still in the URL.
  */
  const asked = useSearchParams().get("date");
  const [date, setDate] = useState(() =>
    asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : todayISO(),
  );
  const [view, setView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      return saved === "week" || saved === "month" ? saved : "day";
    } catch {
      return "day";
    }
  });

  const today = todayISO();

  /*
    Which layers the calendar is drawing.

    Stored as the list that is *shown* rather than the list that is hidden, so
    a layer added in a later version is visible by default instead of silently
    filtered out of everyone's calendar by a saved preference that predates it.
  */
  const [layers, setLayers] = useState<Layer[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? "null");
      if (Array.isArray(saved)) {
        const known = saved.filter((l): l is Layer => ALL_LAYERS.includes(l as Layer));
        // An empty saved list would be a calendar showing nothing, which reads
        // as broken rather than as filtered.
        if (known.length > 0) return known;
      }
    } catch {
      // Unreadable storage. Everything shows, which is the right default.
    }
    return ALL_LAYERS;
  });

  const toggleLayer = (layer: Layer) => {
    setLayers((current) => {
      const next = current.includes(layer)
        ? current.filter((l) => l !== layer)
        : [...current, layer];
      // Turning the last one off leaves an empty grid with no way to read why,
      // so the last layer standing cannot be switched off.
      if (next.length === 0) return current;
      try {
        localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
      } catch {
        // Private browsing. The choice still holds for this session.
      }
      return next;
    });
  };

  /** The important day being added or edited, if any. `date` means adding. */
  const [dayEdit, setDayEdit] = useState<{ id?: string; date?: string } | null>(null);

  const pick = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Private browsing. The choice still holds for this session.
    }
  };

  // The week and month draw from every day on screen, not just the open one.
  const visible = view === "week" ? weekOf(date) : [date];
  const weekItems = useMemo(
    () => store.plan.filter((p) => visible.includes(p.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.plan, visible.join(",")],
  );

  const items = useMemo(
    () =>
      store.plan
        .filter((p) => p.date === date)
        .sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99")),
    [store.plan, date],
  );

  const scheduled = items.filter((p) => p.start != null);
  const loose = items.filter((p) => p.start == null);

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
          <Step label="Previous" onClick={() => setDate(step(date, view, -1))} back />
          <div className="min-w-[170px] text-center">
            <p className="text-sm font-semibold tracking-tight">{heading(date, view)}</p>
            <p className="text-xs text-ink-3">{view === "day" ? pastLabel(date) : subheading(date, view)}</p>
          </div>
          <Step label="Next" onClick={() => setDate(step(date, view, 1))} />
          {!isCurrent(date, view, today) && (
            <Button size="sm" onClick={() => setDate(today)}>
              Today
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {view === "day" && items.length > 0 && (
            <p className="nums text-xs text-ink-3">
              {finished} of {items.length} done
            </p>
          )}
          {view === "day" && <CopyDay date={date} items={items} />}

          <div className="flex rounded-lg border border-line p-0.5">
            {(["day", "week", "month"] as View[]).map((option) => (
              <button
                key={option}
                onClick={() => pick(option)}
                aria-pressed={view === option}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  view === option
                    ? "bg-accent-soft text-accent-text"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="w-[190px]">
            <DateField value={date} onChange={(v) => setDate(v || today)} />
          </div>
        </div>
      </Panel>

      {/*
        The filter sits under the header rather than inside it. It belongs to
        the grid below it, not to the date above it, and a header already
        carrying arrows, a heading, a zoom and a date picker is where controls
        go to become invisible.
      */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {LAYERS.map((layer) => {
          const on = layers.includes(layer.id);
          return (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-accent bg-accent-soft text-accent-text"
                  : "border-line text-ink-3 hover:text-ink"
              }`}
            >
              {layer.label}
            </button>
          );
        })}

        <Button
          size="sm"
          className="ml-auto"
          onClick={() => setDayEdit({ date })}
        >
          + Important day
        </Button>
      </div>

      {view === "month" && (
        <MonthGrid
          month={date}
          layers={layers}
          onOpen={(day) => {
            setDate(day);
            pick("day");
          }}
          onAddDay={(day) => setDayEdit({ date: day })}
          onEditDay={(id) => setDayEdit({ id })}
        />
      )}

      <ImportantDayDialog
        open={dayEdit != null}
        day={dayEdit?.id ? store.importantDays.find((d) => d.id === dayEdit.id) : undefined}
        date={dayEdit?.date}
        onSaved={(saved) => setDate(saved)}
        onClose={() => setDayEdit(null)}
      />

      {view !== "month" && (
      <Split>
        <section>
          <SectionTitle
            right={
              <span className="text-[11px] text-ink-3">
                Drag to move · pull the bottom edge to lengthen
              </span>
            }
          >
            {view === "week" ? "The week" : "The day"}
          </SectionTitle>

          <Marks
            dates={visible}
            layers={layers}
            onEditDay={(id) => setDayEdit({ id })}
          />

          <DayGrid
            dates={visible}
            today={today}
            items={view === "week" ? weekItems.filter((p) => p.start != null) : scheduled}
            onOpenDay={(day) => {
              setDate(day);
              pick("day");
            }}
            onOpenDrag={(e, at, onDate) => {
              const payload = readDrag(e);
              if (!payload) return;

              if (payload.kind === "plan") {
                store.updatePlanItem(payload.id, { start: toClock(at), date: onDate });
                return;
              }
              const task = store.tasks.find((t) => t.id === payload.id);
              if (!task) return;
              store.addPlanItem({
                date: onDate,
                title: task.title,
                start: toClock(at),
                minutes: 45,
                done: false,
                priority: task.priority,
                categoryId: task.categoryId,
                taskId: task.id,
              });
            }}
          />

          {view === "day" && (
            <div className="mt-3">
              <Scheduled date={date} items={scheduled} />
            </div>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <Loose date={date} items={loose} />
          <Habits date={date} />

          <FromTasks date={date} />
        </div>
      </Split>
      )}
    </div>
  );
}

/* --------------------------- Moving through time -------------------------
   The arrows, the heading and the "Today" button all mean something different
   at each zoom, and spelling that out once here keeps the header itself from
   turning into three nested conditionals.
------------------------------------------------------------------------- */

function step(date: string, view: View, direction: number): string {
  if (view === "month") return addMonths(date, direction);
  return addDays(date, direction * (view === "week" ? 7 : 1));
}

function heading(date: string, view: View): string {
  if (view === "month") return monthLabel(date);
  if (view === "week") {
    const week = weekOf(date);
    return `${formatDate(week[0])} – ${formatDate(week[6])}`;
  }
  return formatDate(date);
}

function subheading(date: string, view: View): string {
  if (view === "month") return "";
  const week = weekOf(date);
  return week.includes(todayISO()) ? "This week" : "";
}

/** Whether the current view already contains today, which is when the button is pointless. */
function isCurrent(date: string, view: View, today: string): boolean {
  if (view === "day") return date === today;
  if (view === "week") return startOfWeek(date) === startOfWeek(today);
  return date.slice(0, 7) === today.slice(0, 7);
}

/**
 * What is fixed about these days, above the hours.
 *
 * An exam and a deadline have no start time and no length, so putting them in
 * the hour grid would mean inventing both. They belong above it, the way an
 * all-day row sits above a calendar — the things the day has to work around,
 * before any of the working-around is drawn.
 *
 * Renders nothing when there is nothing, rather than an empty strip: a rule
 * across the page saying "no deadlines" is a line of furniture answering a
 * question nobody asked.
 */
function Marks({
  dates,
  layers,
  onEditDay,
}: {
  dates: string[];
  layers: Layer[];
  onEditDay: (id: string) => void;
}) {
  const store = useStore();

  const rows = dates
    .map((date) => ({ date, marks: dayContents(store, date, layers).marks }))
    .filter((row) => row.marks.length > 0);

  if (rows.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-line bg-panel-2/40 px-2.5 py-2">
      {rows.map((row) => (
        <div key={row.date} className="flex flex-wrap items-center gap-1.5">
          {dates.length > 1 && (
            <span className="text-[11px] font-medium text-ink-3">{formatDate(row.date)}</span>
          )}
          {row.marks.map((mark) => (
            <MarkPill key={`${row.date}-${mark.id}`} mark={mark} onEditDay={onEditDay} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MarkPill({ mark, onEditDay }: { mark: Mark; onEditDay: (id: string) => void }) {
  const label = mark.year ? `${mark.label} (${mark.year} years)` : mark.label;
  const className = `flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
    mark.done ? "text-ink-3 line-through" : ""
  }`;
  const style = mark.done
    ? undefined
    : {
        color: `var(--${mark.priority})`,
        background: `color-mix(in srgb, var(--${mark.priority}) 12%, transparent)`,
      };

  if (mark.kind === "day") {
    return (
      <button onClick={() => onEditDay(mark.id)} className={className} style={style}>
        {label}
      </button>
    );
  }
  return (
    <span className={className} style={style}>
      {label}
    </span>
  );
}

/**
 * The day beside its sidebar.
 *
 * The sidebar is a stack of cards — a box to type into, a habit list, a few
 * task rows — and none of that reads better for being wider. The calendar is
 * the opposite: every extra pixel is more room for a block's title and a
 * clearer sense of how full the day is. So the sidebar holds a fixed width and
 * the day takes everything else, which is why a calendar app looks like this
 * and not like two panes splitting the screen in half.
 *
 * The handle sets the sidebar's width, not a ratio. Remembered per device;
 * double-click resets it.
 */
const SIDEBAR_DEFAULT = 300;
const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 560;

function Split({ children }: { children: ReactNode }) {
  const [left, right] = Array.isArray(children) ? children : [children, null];
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(SPLIT_KEY));
      return Number.isFinite(saved) && saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX
        ? saved
        : SIDEBAR_DEFAULT;
    } catch {
      return SIDEBAR_DEFAULT;
    }
  });

  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;

    // Measured from the right edge, because that is the edge the sidebar is
    // pinned to and the one the number describes.
    const at = (clientX: number) =>
      Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, box.right - clientX));

    const onMove = (move: PointerEvent) => setWidth(at(move.clientX));
    const onUp = (up: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        localStorage.setItem(SPLIT_KEY, String(Math.round(at(up.clientX))));
      } catch {
        // Private browsing. The width still holds for this session.
      }
    };

    // Listeners on the window, not the handle: the pointer routinely leaves a
    // few pixels of strip mid-drag, and a handler bound to it would stop.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const reset = () => {
    setWidth(SIDEBAR_DEFAULT);
    try {
      localStorage.setItem(SPLIT_KEY, String(SIDEBAR_DEFAULT));
    } catch {
      // As above.
    }
  };

  return (
    <div ref={frame} className="flex flex-col gap-6 lg:flex-row lg:gap-0">
      <div className="min-w-0 flex-1 lg:pr-2">{left}</div>

      <div
        onPointerDown={drag}
        onDoubleClick={reset}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the sidebar. Double-click to reset."
        title="Drag to resize · double-click to reset"
        className="group hidden w-3 shrink-0 cursor-col-resize items-center justify-center lg:flex"
      >
        <span className="h-10 w-1 rounded-full bg-[var(--border-strong)] transition-colors group-hover:bg-accent" />
      </div>

      {/* The width goes through a custom property rather than an inline
          `width`, so it applies only at the breakpoint where the two sit side
          by side — stacked on a phone, the sidebar is simply full width. */}
      <div
        className="min-w-0 lg:w-[var(--sidebar-col)] lg:shrink-0"
        style={{ "--sidebar-col": `${width}px` } as React.CSSProperties}
      >
        {right}
      </div>
    </div>
  );
}

/**
 * Repeating a day forward.
 *
 * A student's week is mostly the same shape — the same training, the same
 * study window — and rebuilding that by hand every evening is what makes
 * people abandon a planner. Copies the structure, never the outcome: the new
 * day starts unticked, because copying a day you finished into one you have
 * not lived is how a plan turns into a lie.
 */
function CopyDay({ date, items }: { date: string; items: PlanItem[] }) {
  const store = useStore();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const copyTo = (target: string) => {
    for (const item of items) {
      store.addPlanItem({
        date: target,
        title: item.title,
        start: item.start,
        minutes: item.minutes,
        done: false,
        priority: item.priority,
        categoryId: item.categoryId,
        // The link is to a specific piece of work that is either done or not;
        // pointing a second day at it would let one tick close both.
        taskId: null,
      });
    }
    setOpen(false);
  };

  return (
    <>
      <button
        ref={anchor}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-line px-2 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:bg-panel-2 hover:text-ink"
      >
        Copy day
      </button>

      {/* Through the shared Popover rather than an absolutely-positioned child:
          the page's entry animation leaves a transform on an ancestor, and a
          transform creates a stacking context that any z-index inside it
          cannot escape — the menu opened underneath the column beside it. */}
      <Popover
        anchorRef={anchor}
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        maxHeight={260}
      >
        {[
          { label: "Tomorrow", days: 1 },
          { label: "In 2 days", days: 2 },
          { label: "Next week", days: 7 },
        ].map((option) => (
          <button
            key={option.days}
            onClick={() => copyTo(addDays(date, option.days))}
            className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-xs text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            {option.label}
            <span className="text-ink-3">{formatDate(addDays(date, option.days))}</span>
          </button>
        ))}

        <p className="border-t border-line px-2 pb-1 pt-2 text-[10px] text-ink-3">
          Copies {items.length} {items.length === 1 ? "block" : "blocks"}, unticked.
        </p>

        <div className="p-1">
          <DateField
            value=""
            onChange={(v) => {
              if (v) copyTo(v);
            }}
          />
        </div>
      </Popover>
    </>
  );
}

/**
 * The scheduled blocks as rows, under the grid.
 *
 * The grid answers "what does my day look like" and is a poor place to type;
 * these rows are where a block gets renamed, re-timed or removed. Two views of
 * one list, each doing the thing the other is bad at.
 */
function Scheduled({ date, items }: { date: string; items: PlanItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-3.5 py-5 text-center text-[13px] text-ink-3">
        Nothing timed yet. Double-click the grid, or drag a task in from the right.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <Item key={item.id} item={item} />
      ))}
    </div>
  );
}

/** A single block: tick it, rename it, retime it, remove it. */
function Item({ item }: { item: PlanItem }) {
  const store = useStore();
  const category = store.categories.find((c) => c.id === item.categoryId);
  const task = item.taskId ? store.tasks.find((t) => t.id === item.taskId) : null;

  // Only the grip starts a drag. With the whole row draggable, selecting text
  // in the title drags the row instead, which makes renaming impossible.
  const [dragging, setDragging] = useState(false);
  const [armed, setArmed] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <div
        draggable={armed}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, dragPayload("plan", item.id));
          e.dataTransfer.effectAllowed = "move";
          setDragging(true);
        }}
        onDragEnd={() => {
          setDragging(false);
          setArmed(false);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        className={`group flex items-center gap-2.5 rounded-lg border border-line bg-panel px-2.5 py-2 transition-[opacity,border-color] hover:border-line-strong ${
          dragging ? "opacity-40" : ""
        }`}
        style={
          category ? { borderLeft: `3px solid ${courseColor(category.color)}` } : undefined
        }
      >
        <span
          onPointerDown={() => setArmed(true)}
          onPointerUp={() => setArmed(false)}
          aria-hidden
          title="Drag to another time"
          className="-ml-1 shrink-0 cursor-grab select-none text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        >
          <svg viewBox="0 0 16 16" className="size-3">
            <path
              d="M6 4h.01M6 8h.01M6 12h.01M10 4h.01M10 8h.01M10 12h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <Tick checked={item.done} onChange={() => store.togglePlanItem(item.id)} />

        <PriorityPicker
          value={item.priority}
          onChange={(priority) => store.updatePlanItem(item.id, { priority })}
        />

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
          <span
            className="shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-[10px] text-ink-3"
            title={`Linked to the task "${task.title}"`}
          >
            task
          </span>
        )}

        {/* Times only, and the length reads out of them. The row used to carry
            a time field, a duration select, a move button and a delete button
            all at once, which made four controls compete for a glance that was
            only ever checking when something starts. The rest moved to the
            right-click menu. */}
        {item.start != null ? (
          <>
            <TimeRange
              start={item.start}
              minutes={item.minutes}
              onChange={(patch) => store.updatePlanItem(item.id, patch)}
            />
            <span className="nums w-8 shrink-0 text-right text-[11px] text-ink-3">
              {length(item.minutes)}
            </span>
          </>
        ) : (
          <button
            onClick={() => store.updatePlanItem(item.id, { start: "09:00" })}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            Set a time
          </button>
        )}
      </div>

      {menu && <PlanItemMenu item={item} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </>
  );
}

/** Minutes between two clock times on the same day. */
function spanMinutes(from: string, to: string): number {
  const at = (clock: string) => {
    const [h, m] = clock.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  return at(to) - at(from);
}

function length(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [over, setOver] = useState(false);

  const add = () => {
    const title = draft.trim();
    if (title === "") return;

    // Both times are optional and independent: a start with no end is the
    // common case, an end with no start says nothing useful, and neither is
    // worth refusing the whole entry over.
    const start = /^([01]\d|2[0-3]):[0-5]\d$/.test(from) ? from : null;
    const span = start && to ? spanMinutes(start, to) : null;

    store.addPlanItem({
      date,
      title,
      start,
      minutes: span && span > 0 ? span : start ? 45 : 30,
      done: false,
      priority: "medium",
      categoryId: null,
      taskId: null,
    });
    setDraft("");
    setFrom("");
    setTo("");
  };

  return (
    <section>
      <SectionTitle>Also today</SectionTitle>
      <div
        onDragOver={(e: React.DragEvent) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e: React.DragEvent) => {
          e.preventDefault();
          setOver(false);
          const payload = readDrag(e);
          if (!payload) return;

          // Dropping here is how a block gives up its hour without being
          // deleted and retyped.
          if (payload.kind === "plan") {
            store.updatePlanItem(payload.id, { start: null, date });
            return;
          }
          const task = store.tasks.find((t) => t.id === payload.id);
          if (!task) return;
          store.addPlanItem({
            date,
            title: task.title,
            start: null,
            minutes: 45,
            done: false,
            priority: task.priority,
            categoryId: task.categoryId,
            taskId: task.id,
          });
        }}
        className={`divide-y divide-[var(--border)] rounded-xl border bg-panel shadow-[var(--shadow),var(--edge)] transition-colors ${
          over ? "border-accent/50 bg-accent-soft/40" : "border-line"
        }`}
      >
        {items.map((item) => (
          <div key={item.id} className="px-2 py-1.5">
            <Item item={item} />
          </div>
        ))}
        <div className="flex flex-col gap-2 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              placeholder="Add something for today…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
            />
            <Button size="sm" onClick={add} disabled={draft.trim() === ""}>
              Add
            </Button>
          </div>

          {/* Only once there is something to add: two empty time fields above
              an empty box is a form, and this should feel like typing a line. */}
          {draft.trim() !== "" && (
            <div className="flex items-center gap-1.5">
              <div className="w-[86px]">
                <TimeField value={from} onChange={setFrom} />
              </div>
              <span aria-hidden className="text-[11px] text-ink-3">
                –
              </span>
              <div className="w-[86px]">
                <TimeField value={to} onChange={setTo} />
              </div>
              <span className="text-[10px] text-ink-3">both optional</span>
            </div>
          )}
        </div>
      </div>
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
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, dragPayload("task", task.id));
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() =>
                store.addPlanItem({
                  date,
                  title: task.title,
                  start: null,
                  minutes: 45,
                  done: false,
                  // The work already has an importance; the block inherits it
                  // rather than asking the student to say it twice.
                  priority: task.priority,
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

function relative(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `${d}d`;
}

/**
 * How much a block matters, as a dot you click.
 *
 * A select would be four times the width for something most blocks never
 * change. The dot carries the colour the rest of the app already uses for
 * priority, so it needs no label to be read.
 */
function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={anchor}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Priority: ${PRIORITY_LABEL[value]}`}
        title={PRIORITY_LABEL[value]}
        className="grid size-4 shrink-0 place-items-center rounded transition-colors hover:bg-panel"
      >
        <PriorityDot priority={value} />
      </button>

      <Popover anchorRef={anchor} open={open} onClose={() => setOpen(false)} maxHeight={180}>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            onClick={() => {
              onChange(p);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-panel-2 ${
              p === value ? "text-ink" : "text-ink-2"
            }`}
          >
            <PriorityDot priority={p} />
            {PRIORITY_LABEL[p]}
          </button>
        ))}
      </Popover>
    </>
  );
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
