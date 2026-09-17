"use client";

import { useRef, useState } from "react";
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
 */

const FIRST_HOUR = 6;
const LAST_HOUR = 23;
const HOUR_PX = 56;
const SNAP_MIN = 15;
const MIN_DURATION = 15;

const PX_PER_MIN = HOUR_PX / 60;
const GRID_START = FIRST_HOUR * 60;
const GRID_MIN = (LAST_HOUR - FIRST_HOUR + 1) * 60;

/** What the pointer is currently doing to which block. */
interface Drag {
  id: string;
  mode: "move" | "resize";
  /** Pointer position when it started, so movement is measured as a delta. */
  originY: number;
  startMin: number;
  minutes: number;
  /** Live values, so the block follows the pointer without a store write per pixel. */
  previewStart: number;
  previewMinutes: number;
}

export function DayGrid({
  date,
  today,
  items,
  onOpenDrag,
}: {
  date: string;
  today: string;
  items: PlanItem[];
  /** Reads a drag coming from outside the grid, e.g. a task being scheduled. */
  onOpenDrag: (e: React.DragEvent, minutesFromMidnight: number) => void;
}) {
  const store = useStore();
  const surface = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const begin = (e: React.PointerEvent, item: PlanItem, mode: Drag["mode"]) => {
    if (item.start == null) return;
    e.preventDefault();
    e.stopPropagation();
    // Capture keeps the drag alive if the pointer leaves the block, but it is
    // an optimisation: it throws for a pointer the element never saw, and an
    // exception here would abort the drag before it began.
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Dragging still works through the surface's own handlers.
    }

    const startMin = toMinutes(item.start);
    setDrag({
      id: item.id,
      mode,
      originY: e.clientY,
      startMin,
      minutes: item.minutes,
      previewStart: startMin,
      previewMinutes: item.minutes,
    });
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const deltaMin = snap((e.clientY - drag.originY) / PX_PER_MIN);

    if (drag.mode === "move") {
      // Clamped so a block cannot be dragged off either end of the day.
      const start = clamp(
        drag.startMin + deltaMin,
        GRID_START,
        GRID_START + GRID_MIN - drag.minutes,
      );
      setDrag({ ...drag, previewStart: start });
    } else {
      const minutes = clamp(
        drag.minutes + deltaMin,
        MIN_DURATION,
        GRID_START + GRID_MIN - drag.startMin,
      );
      setDrag({ ...drag, previewMinutes: minutes });
    }
  };

  // One write, at the end. Committing on every pointer move would put a
  // hundred rows through the store and, on the cloud backend, the network.
  const end = () => {
    if (!drag) return;
    if (drag.mode === "move" && drag.previewStart !== drag.startMin) {
      store.updatePlanItem(drag.id, { start: toClock(drag.previewStart) });
    }
    if (drag.mode === "resize" && drag.previewMinutes !== drag.minutes) {
      store.updatePlanItem(drag.id, { minutes: drag.previewMinutes });
    }
    setDrag(null);
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

  const laid = layout(items);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = date === today && nowMin >= GRID_START && nowMin <= GRID_START + GRID_MIN;

  return (
    <div className="flex overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow),var(--edge)]">
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
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onDragOver={(e) => {
          e.preventDefault();
          setDropAt(minutesAt(e.clientY));
        }}
        onDragLeave={() => setDropAt(null)}
        onDrop={(e) => {
          const at = minutesAt(e.clientY);
          setDropAt(null);
          onOpenDrag(e, at);
        }}
        onDoubleClick={(e) => {
          // Double-click on empty space is how a calendar makes a new entry,
          // and it lands where the pointer is rather than at a fixed hour.
          if (e.target !== surface.current) return;
          store.addPlanItem({
            date,
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

        {showNow && (
          <div
            aria-hidden
            style={{ top: (nowMin - GRID_START) * PX_PER_MIN }}
            className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-accent"
          >
            <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-accent" />
          </div>
        )}

        {dropAt != null && (
          <div
            aria-hidden
            style={{ top: (dropAt - GRID_START) * PX_PER_MIN, height: 45 * PX_PER_MIN }}
            className="pointer-events-none absolute inset-x-1 z-10 rounded-md border-2 border-dashed border-accent/60 bg-accent-soft/50"
          />
        )}

        {laid.map(({ item, column, columns }) => {
          const active = drag?.id === item.id;
          const startMin = active ? drag.previewStart : toMinutes(item.start ?? "00:00");
          const minutes = active ? drag.previewMinutes : item.minutes;
          const category = store.categories.find((c) => c.id === item.categoryId);
          const width = 100 / columns;

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
                top: (startMin - GRID_START) * PX_PER_MIN,
                height: Math.max(minutes * PX_PER_MIN, 18),
                left: `calc(${column * width}% + 4px)`,
                width: `calc(${width}% - 8px)`,
                borderLeftColor: category ? courseColor(category.color) : undefined,
              }}
              className={`group absolute z-10 cursor-grab overflow-hidden rounded-md border border-l-[3px] bg-panel-2 px-1.5 py-1 transition-shadow active:cursor-grabbing ${
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
              {minutes >= 40 && (
                <p className="nums mt-0.5 text-[10px] text-ink-3">
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
        })}
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
