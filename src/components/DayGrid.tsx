"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PlanItem } from "@/lib/types";
import { courseColor } from "@/lib/appearance";
import { PlanItemMenu } from "./PlanItemMenu";

/**
 * The day as a surface, not a list of rows.
 *
 * Blocks are positioned and sized by their time, so a ninety-minute block is
 * visibly longer than a thirty-minute one and an empty afternoon looks empty.
 * That is the whole reason to draw a calendar rather than print a list: the
 * shape of the day is the information.
 *
 * Dragging moves and the bottom edge resizes, both snapped to a quarter hour,
 * because nobody plans to start something at 14:07 and a grid that lets them
 * only produces times they have to tidy up later.
 *
 * The snap is where it lands, not how it moves. The block follows the pointer
 * pixel for pixel while a dashed outline shows the quarter-hour it will drop
 * into, and on release it glides the last few pixels into place. Moving in
 * fourteen-pixel jumps was accurate and felt like dragging something through
 * gravel.
 *
 * Holding a block near the top or bottom of the window scrolls the page, faster
 * the closer to the edge. Without it, moving something from the morning to the
 * evening meant dropping it at the bottom of the screen, scrolling, picking it
 * up again — three gestures for one decision.
 */

const FIRST_HOUR = 6;
const LAST_HOUR = 23;
const HOUR_PX = 56;
const SNAP_MIN = 15;
const MIN_DURATION = 15;

/** How near the window edge auto-scroll starts, and its top speed per frame. */
const EDGE_PX = 80;
const MAX_SCROLL = 22;

const PX_PER_MIN = HOUR_PX / 60;
const GRID_START = FIRST_HOUR * 60;
const GRID_MIN = (LAST_HOUR - FIRST_HOUR + 1) * 60;

/** What the pointer is currently doing to which block. */
interface Drag {
  id: string;
  mode: "move" | "resize";
  /**
   * Pointer position when it started, in page coordinates — viewport position
   * plus how far the page was scrolled. Measured that way so auto-scroll moves
   * the block with the content instead of leaving it behind under a pointer
   * that never moved.
   */
  originY: number;
  /** Unsnapped travel in pixels, so the block can follow the pointer exactly. */
  travel: number;
  startMin: number;
  minutes: number;
  /** Live values, so the block follows the pointer without a store write per pixel. */
  previewStart: number;
  previewMinutes: number;
  /** The day the block started on, and the one it is currently over. */
  fromDate: string;
  previewDate: string;
}

export function DayGrid({
  dates,
  today,
  items,
  onOpenDrag,
  onOpenDay,
}: {
  /**
   * One date for the day view, seven for the week.
   *
   * The same surface draws both: a week is a day repeated sideways, and the
   * alternative — a second component with its own copy of the drag, resize and
   * overlap arithmetic — is two things to keep in agreement forever.
   */
  dates: string[];
  today: string;
  items: PlanItem[];
  /** Reads a drag coming from outside the grid, e.g. a task being scheduled. */
  onOpenDrag: (e: React.DragEvent, minutesFromMidnight: number, date: string) => void;
  /** Opening one day out of a week. Absent in the day view, which is already there. */
  onOpenDay?: (date: string) => void;
}) {
  const store = useStore();
  const surface = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  /*
    The drag lives in a ref as well as in state. Window listeners and the
    auto-scroll loop run outside React's render cycle, and reading `drag` from
    their closures would see the value from whenever they were attached.
  */
  const dragRef = useRef<Drag | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const scroller = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);
  const listeners = useRef<(() => void) | null>(null);

  const put = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  /** Where the drag is, given the pointer and how far the page has scrolled. */
  const apply = () => {
    const dr = dragRef.current;
    if (!dr) return;
    const travel = pointer.current.y + scrollTop(scroller.current) - dr.originY;
    const deltaMin = snap(travel / PX_PER_MIN);

    if (dr.mode === "move") {
      // Clamped so a block cannot be dragged off either end of the day.
      const start = clamp(dr.startMin + deltaMin, GRID_START, GRID_START + GRID_MIN - dr.minutes);
      // Sideways changes the day. In the day view there is only one column, so
      // this always resolves back to the same date.
      put({ ...dr, travel, previewStart: start, previewDate: dateAt(pointer.current.x) });
    } else {
      const minutes = clamp(dr.minutes + deltaMin, MIN_DURATION, GRID_START + GRID_MIN - dr.startMin);
      put({ ...dr, travel, previewMinutes: minutes });
    }
  };

  /*
    Auto-scroll, one frame at a time.

    Runs for the whole drag rather than only on pointer moves, because the case
    it exists for is the pointer held still at the bottom edge — no events at
    all — while the page keeps sliding underneath it. Speed ramps with how deep
    into the edge band the pointer is, so it can be nudged a little or sent
    flying.
  */
  const tick = () => {
    if (!dragRef.current) {
      frame.current = null;
      return;
    }
    const { top, bottom } = visibleBand(scroller.current);
    const y = pointer.current.y;
    let speed = 0;
    if (y > bottom - EDGE_PX) speed = ramp(y - (bottom - EDGE_PX));
    else if (y < top + EDGE_PX) speed = -ramp(top + EDGE_PX - y);

    if (speed !== 0) {
      const before = scrollTop(scroller.current);
      scrollBy(scroller.current, speed);
      if (scrollTop(scroller.current) !== before) apply();
    }
    frame.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    listeners.current?.();
    listeners.current = null;
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  // Never leave a loop or a window listener behind if the grid unmounts mid-drag.
  useEffect(() => stop, []);

  const begin = (e: React.PointerEvent, item: PlanItem, mode: Drag["mode"]) => {
    if (item.start == null) return;
    e.preventDefault();
    e.stopPropagation();

    scroller.current = scrollParent(surface.current);
    pointer.current = { x: e.clientX, y: e.clientY };

    const startMin = toMinutes(item.start);
    put({
      id: item.id,
      mode,
      originY: e.clientY + scrollTop(scroller.current),
      travel: 0,
      startMin,
      minutes: item.minutes,
      previewStart: startMin,
      previewMinutes: item.minutes,
      fromDate: item.date,
      previewDate: item.date,
    });

    /*
      On the window, not on the grid. Auto-scroll needs the pointer near the
      edge of the screen, which is usually outside the grid, and a release out
      there used to be missed entirely — leaving a block stuck to the cursor.
    */
    // Anything left over from a drag that never saw its pointerup.
    stop();

    const onMove = (ev: PointerEvent) => {
      pointer.current = { x: ev.clientX, y: ev.clientY };
      apply();
    };
    const onUp = () => end();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    listeners.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    frame.current = requestAnimationFrame(tick);
  };

  // One write, at the end. Committing on every pointer move would put a
  // hundred rows through the store and, on the cloud backend, the network.
  const end = () => {
    const dr = dragRef.current;
    stop();
    if (!dr) return;
    if (
      dr.mode === "move" &&
      (dr.previewStart !== dr.startMin || dr.previewDate !== dr.fromDate)
    ) {
      store.updatePlanItem(dr.id, {
        start: toClock(dr.previewStart),
        date: dr.previewDate,
      });
    }
    if (dr.mode === "resize" && dr.previewMinutes !== dr.minutes) {
      store.updatePlanItem(dr.id, { minutes: dr.previewMinutes });
    }
    put(null);
  };

  /** The date under a horizontal position. In the day view, always the one. */
  const dateAt = (clientX: number): string => {
    const box = surface.current?.getBoundingClientRect();
    if (!box || dates.length === 1) return dates[0];
    const index = Math.floor(((clientX - box.left) / box.width) * dates.length);
    return dates[clamp(index, 0, dates.length - 1)];
  };

  const minutesAt = (clientY: number): number => {
    const box = surface.current?.getBoundingClientRect();
    if (!box) return GRID_START;
    return clamp(
      snap((clientY - box.top) / PX_PER_MIN) + GRID_START,
      GRID_START,
      GRID_START + GRID_MIN - SNAP_MIN,
    );
  };

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = dates.includes(today) && nowMin >= GRID_START && nowMin <= GRID_START + GRID_MIN;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow),var(--edge)]">
      {dates.length > 1 && (
        <div className="flex border-b border-line">
          <div className="w-14 shrink-0 border-r border-line" />
          {dates.map((date) => {
            const isToday = date === today;
            return (
              <button
                key={date}
                onClick={() => onOpenDay?.(date)}
                className="flex-1 border-r border-line py-1.5 text-center transition-colors last:border-r-0 hover:bg-panel-2"
              >
                <span className="block text-[10px] uppercase tracking-wide text-ink-3">
                  {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span
                  className={`nums mx-auto mt-0.5 grid size-6 place-items-center rounded-full text-[12px] font-medium ${
                    isToday ? "bg-accent text-white" : "text-ink"
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex">
      <div className="w-14 shrink-0 border-r border-line">
        {hours().map((hour) => (
          <div
            key={hour}
            style={{ height: HOUR_PX }}
            className="nums relative pr-2 text-right text-[11px] text-ink-3"
          >
            <span className="absolute right-2 -top-1.5">
              {hour === FIRST_HOUR ? "" : `${String(hour).padStart(2, "0")}:00`}
            </span>
          </div>
        ))}
      </div>

      <div
        ref={surface}
        onDragOver={(e) => {
          e.preventDefault();
          setDropAt(minutesAt(e.clientY));
        }}
        onDragLeave={() => setDropAt(null)}
        onDrop={(e) => {
          const at = minutesAt(e.clientY);
          setDropAt(null);
          onOpenDrag(e, at, dateAt(e.clientX));
        }}
        onDoubleClick={(e) => {
          // Double-click on empty space is how a calendar makes a new entry,
          // and it lands where the pointer is rather than at a fixed hour.
          if (e.target !== surface.current) return;
          store.addPlanItem({
            date: dateAt(e.clientX),
            title: "",
            start: toClock(minutesAt(e.clientY)),
            minutes: 60,
            done: false,
            priority: "medium",
            categoryId: null,
            taskId: null,
          });
        }}
        className="relative flex-1 select-none"
        style={{ height: GRID_MIN * PX_PER_MIN }}
      >
        {hours().map((hour, i) => (
          <div
            key={hour}
            aria-hidden
            style={{ top: i * HOUR_PX }}
            className="pointer-events-none absolute inset-x-0 border-t border-line"
          />
        ))}

        {dates.slice(1).map((date, i) => (
          <div
            key={date}
            aria-hidden
            style={{ left: `${((i + 1) / dates.length) * 100}%` }}
            className="pointer-events-none absolute inset-y-0 border-l border-line"
          />
        ))}

        {/* Weekends get a wash, so the shape of a week is readable before
            reading any of it. */}
        {dates.length > 1 &&
          dates.map((date, i) =>
            [5, 6].includes((new Date(`${date}T12:00:00`).getDay() + 6) % 7) ? (
              <div
                key={`wknd-${date}`}
                aria-hidden
                style={{ left: `${(i / dates.length) * 100}%`, width: `${100 / dates.length}%` }}
                className="pointer-events-none absolute inset-y-0 bg-panel-2/40"
              />
            ) : null,
          )}

        {showNow && (
          <div
            aria-hidden
            style={{
              top: (nowMin - GRID_START) * PX_PER_MIN,
              left: `${(dates.indexOf(today) / dates.length) * 100}%`,
              width: `${100 / dates.length}%`,
            }}
            className="pointer-events-none absolute z-20 border-t-2 border-accent"
          >
            <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-accent" />
          </div>
        )}

        {/* Where the held block will land. The block itself follows the
            pointer freely; this is the quarter hour it snaps to. */}
        {drag &&
          (() => {
            const dayIndex = dates.indexOf(drag.previewDate);
            if (dayIndex === -1) return null;
            const dayWidth = 100 / dates.length;
            return (
              <div
                aria-hidden
                style={{
                  top: (drag.previewStart - GRID_START) * PX_PER_MIN,
                  height: Math.max(drag.previewMinutes * PX_PER_MIN, 18),
                  left: `calc(${dayIndex * dayWidth}% + 3px)`,
                  width: `calc(${dayWidth}% - 6px)`,
                  transition: "top 90ms ease-out, height 90ms ease-out, left 120ms ease-out",
                }}
                className="pointer-events-none absolute z-[5] rounded-md border-2 border-dashed border-accent/50 bg-accent-soft/30"
              />
            );
          })()}

        {dropAt != null && (
          <div
            aria-hidden
            style={{ top: (dropAt - GRID_START) * PX_PER_MIN, height: 45 * PX_PER_MIN }}
            className="pointer-events-none absolute inset-x-1 z-10 rounded-md border-2 border-dashed border-accent/60 bg-accent-soft/50"
          />
        )}

        {dates.flatMap((date, dayIndex) =>
          layout(items.filter((i) => (drag?.id === i.id ? drag.previewDate : i.date) === date)).map(
            ({ item, column, columns }) => {
              const active = drag?.id === item.id;
              // Where it will land, snapped — for the time label and the outline.
              const startMin = active ? drag.previewStart : toMinutes(item.start ?? "00:00");
              const minutes = active ? drag.previewMinutes : item.minutes;
              const category = store.categories.find((c) => c.id === item.categoryId);

              // Where it is drawn: under the pointer, unsnapped, while dragging.
              const storedStart = toMinutes(item.start ?? "00:00");
              const top =
                active && drag.mode === "move"
                  ? clamp(
                      (drag.startMin - GRID_START) * PX_PER_MIN + drag.travel,
                      0,
                      (GRID_MIN - drag.minutes) * PX_PER_MIN,
                    )
                  : ((active ? drag.startMin : storedStart) - GRID_START) * PX_PER_MIN;
              const height =
                active && drag.mode === "resize"
                  ? clamp(
                      drag.minutes * PX_PER_MIN + drag.travel,
                      MIN_DURATION * PX_PER_MIN,
                      (GRID_START + GRID_MIN - drag.startMin) * PX_PER_MIN,
                    )
                  : Math.max(minutes * PX_PER_MIN, 18);

              // The block sits inside its day's slice of the surface, and
              // inside that, inside its overlap column.
              const dayWidth = 100 / dates.length;
              const dayLeft = dayIndex * dayWidth;
              const width = dayWidth / columns;

          return (
            <div
              key={item.id}
              onPointerDown={(e) => {
                // Right-click and two-finger tap both arrive as button 2, and
                // starting a drag from one leaves a block stuck to the pointer.
                if (e.button !== 0) return;
                begin(e, item, "move");
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ id: item.id, x: e.clientX, y: e.clientY });
              }}
              style={{
                top,
                height,
                left: `calc(${dayLeft + column * width}% + 3px)`,
                width: `calc(${width}% - 6px)`,
                borderLeftColor: category ? courseColor(category.color) : undefined,
                /*
                  Two motions, and they must not be the same one. While held,
                  top and height follow the pointer with no easing at all — any
                  transition there is lag. Everything else glides: the drop into
                  the snapped slot on release, a jump to another day's column,
                  and neighbours sliding aside as overlaps open and close.
                */
                transition: active
                  ? "left 140ms ease-out, width 140ms ease-out, box-shadow 160ms, transform 160ms"
                  : "top 220ms cubic-bezier(.2,.8,.2,1), height 220ms cubic-bezier(.2,.8,.2,1), left 220ms cubic-bezier(.2,.8,.2,1), width 220ms cubic-bezier(.2,.8,.2,1), box-shadow 160ms, transform 160ms",
                // Lifted off the page while held, so it reads as picked up.
                transform: active ? "scale(1.02)" : undefined,
                zIndex: active ? 30 : undefined,
              }}
              className={`group absolute z-10 cursor-grab overflow-hidden rounded-md border border-l-[3px] bg-panel-2 px-1.5 py-1 active:cursor-grabbing ${
                active ? "shadow-[var(--shadow-md)] ring-1 ring-accent" : "border-line"
              } ${item.done ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-1">
                <span
                  aria-hidden
                  className="mt-[3px] size-1.5 shrink-0 rounded-full"
                  style={{ background: `var(--${item.priority})` }}
                />
                {renaming === item.id ? (
                  <input
                    autoFocus
                    defaultValue={item.title}
                    onPointerDown={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      store.updatePlanItem(item.id, { title: e.target.value });
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      // Saves outright rather than by blurring: losing a rename
                      // because focus moved somewhere unexpected is the kind of
                      // thing that only shows up once someone has typed a
                      // sentence they did not want to type twice.
                      if (e.key === "Enter") {
                        store.updatePlanItem(item.id, { title: e.currentTarget.value });
                        setRenaming(null);
                      }
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-accent bg-bg px-1 text-[11px] font-medium outline-none"
                  />
                ) : (
                  <p
                    className={`min-w-0 flex-1 truncate text-[11px] font-medium leading-tight ${
                      item.done ? "text-ink-3 line-through" : ""
                    }`}
                  >
                    {item.title || "Untitled"}
                  </p>
                )}
              </div>
              {/* Always while held: the outline says where, this says when,
                  and on a short block the time is otherwise hidden. */}
              {(minutes >= 40 || active) && (
                <p
                  className={`nums mt-0.5 text-[10px] ${active ? "font-semibold text-accent-text" : "text-ink-3"}`}
                >
                  {toClock(startMin)}–{toClock(startMin + minutes)}
                </p>
              )}

              {/* The grab strip for length. Kept thin and only visible on
                  hover, so it never competes with the block itself. */}
              <span
                onPointerDown={(e) => begin(e, item, "resize")}
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
              >
                <span className="mx-auto block h-0.5 w-6 translate-y-0.5 rounded-full bg-ink-3" />
              </span>
            </div>
              );
            },
          ),
        )}
      </div>

      </div>

      {menu && (
        <PlanItemMenu
          item={items.find((i) => i.id === menu.id)}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onRename={() => {
            setRenaming(menu.id);
            setMenu(null);
          }}
        />
      )}
    </div>
  );
}

function hours(): number[] {
  return Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
}

function toMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function toClock(minutes: number): string {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * The element that scrolls when the page does — the nearest ancestor with its
 * own scrollbar, or null for the window itself. Looked up rather than assumed,
 * because the planner sits in the normal page flow today and nothing stops a
 * later layout from giving it a scroll box of its own.
 */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

function scrollTop(el: HTMLElement | null): number {
  return el ? el.scrollTop : window.scrollY;
}

function scrollBy(el: HTMLElement | null, dy: number) {
  if (el) el.scrollTop += dy;
  else window.scrollBy(0, dy);
}

/**
 * The part of the screen content is actually visible in.
 *
 * For the window that starts below the sticky header — the band under the
 * header is where someone dragging upward would put the pointer, and treating
 * the very top of the viewport as the edge meant it never fired.
 */
function visibleBand(el: HTMLElement | null): { top: number; bottom: number } {
  if (el) {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  }
  const header = document.querySelector("header.sticky");
  return { top: header ? header.getBoundingClientRect().bottom : 0, bottom: window.innerHeight };
}

/** Pixels per frame for a pointer this far into the edge band. Eased, and capped. */
function ramp(depth: number): number {
  const t = Math.min(1, Math.max(0, depth / EDGE_PX));
  return Math.round(2 + t * t * (MAX_SCROLL - 2));
}

function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MIN) * SNAP_MIN;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Side-by-side placement for blocks that overlap in time.
 *
 * Greedy and deliberately simple: walk the day in order, and give each block
 * the first column whose last block has already finished. Two things at once
 * are rare in a student's plan, and a full interval-packing algorithm would be
 * a lot of code for a case that is usually a mistake the student wants to see.
 */
function layout(items: PlanItem[]): { item: PlanItem; column: number; columns: number }[] {
  const sorted = [...items]
    .filter((i) => i.start != null)
    .sort((a, b) => toMinutes(a.start as string) - toMinutes(b.start as string));

  const out: { item: PlanItem; column: number; columns: number }[] = [];
  let cluster: typeof out = [];
  let clusterEnd = -1;
  const columnEnds: number[] = [];

  const flush = () => {
    const columns = Math.max(1, columnEnds.length);
    for (const entry of cluster) entry.columns = columns;
    out.push(...cluster);
    cluster = [];
    columnEnds.length = 0;
    clusterEnd = -1;
  };

  for (const item of sorted) {
    const start = toMinutes(item.start as string);
    const end = start + item.minutes;

    // A gap means the previous overlap group is closed, and the next block
    // starts again at full width.
    if (start >= clusterEnd && cluster.length > 0) flush();

    let column = columnEnds.findIndex((e) => e <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }

    cluster.push({ item, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return out;
}
